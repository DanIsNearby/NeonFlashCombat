from flask import Flask, render_template, jsonify, request
import requests
import time
import qrcode
import io
import base64
from adafruit_pn532.i2c import PN532_I2C
import board
import busio
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# API base URL
API_BASE_URL = 'http://212.47.228.161:3000/api'  # Adjust this to your Express.js server address

# Set up NFC reader
i2c = busio.I2C(board.SCL, board.SDA)
pn532 = PN532_I2C(i2c, debug=False)
pn532.SAM_configuration()

def read_nfc(timeout=120):
    start_time = time.time()
    while time.time() - start_time < timeout:
        uid = pn532.read_passive_target(timeout=0.5)
        if uid is not None:
            return ''.join([format(i, '02x') for i in uid])
        time.sleep(0.1)  # Short sleep to prevent busy-waiting
    return None

def generate_qr_code(player_id):
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(f"https://t.me/tonreflexbot?start={player_id}")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    return base64.b64encode(img_io.getvalue()).decode()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scan_player/<int:player_number>', methods=['POST'])
def scan_player(player_number):
    player_id = read_nfc(timeout=120)  # 2 minutes timeout
    if player_id:
        response = requests.get(f'{API_BASE_URL}/check_player/{player_id}')
        if response.json().get('exists'):
            return jsonify({"status": "success", "playerId": player_id})
        else:
            qr_code = generate_qr_code(player_id)
            return jsonify({"status": "not_registered", "playerId": player_id, "qrCode": qr_code})
    else:
        return jsonify({"status": "error", "message": "No NFC tag detected after 2 minutes"})

@app.route('/start_game_delay', methods=['POST'])
def start_game_delay():
    time.sleep(2)  # 2-second delay
    return jsonify({"status": "success", "message": "Game starting"})

@app.route('/check_registration/<player_id>', methods=['GET'])
def check_registration(player_id):
    response = requests.get(f'{API_BASE_URL}/check_player/{player_id}')
    return jsonify({"registered": response.json().get('exists', False)})

@app.route('/get_player_data', methods=['POST'])
def get_players_data():
    player1_id = request.json['player1Id']
    player2_id = request.json['player2Id']
    response = requests.post(f'{API_BASE_URL}/get_players_data', json={
        'player1Id': player1_id,
        'player2Id': player2_id
    })
    return jsonify(response.json())

@app.route('/check_nfc_tap', methods=['POST'])
def check_nfc_tap():
    player1_id = request.json['player1Id']
    player2_id = request.json['player2Id']
    current_color = request.json['currentColor']
    
    # logger.debug(f"Checking NFC tap for players: {player1_id}, {player2_id}")
    # logger.debug(f"Current color: {current_color}")
    
    player_id = read_nfc(timeout=0.1)  # Short timeout for quick checks
    if player_id:
        logger.info(f"NFC tap detected: {player_id}")
        if player_id in [player1_id, player2_id]:
            response = requests.post(f'{API_BASE_URL}/update_score', json={
                'playerId': player_id,
                'color': current_color
            })
            data = response.json()
            logger.info(f"Score update response: {data}")
            
            # Fetch updated scores for both players
            players_data = requests.post(f'{API_BASE_URL}/get_players_data', json={
                'player1Id': player1_id,
                'player2Id': player2_id
            }).json()
            logger.info(f"Updated player data: {players_data}")

            return jsonify({
                "tapped": True,
                "player1Score": players_data.get('player1', {}).get('points', 0),
                "player2Score": players_data.get('player2', {}).get('points', 0),
                "newScore": data.get('newScore', 0),
                "tappedPlayerId": player_id,
                "pointChange": data.get('pointChange', 0)
            })
    else:
        what = "no"
        # logger.debug("No NFC tap detected")
    return jsonify({"tapped": False})

if __name__ == '__main__':
    app.run(debug=True)