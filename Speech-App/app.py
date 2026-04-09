import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import azure.cognitiveservices.speech as speechsdk
import uuid

load_dotenv()

app = Flask(__name__)

# Ensure static folder exists
os.makedirs('static', exist_ok=True)

SPEECH_KEY = os.getenv('SPEECH_KEY')
SPEECH_REGION = os.getenv('SPEECH_REGION')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/tts', methods=['POST'])
def text_to_speech():
    data = request.get_json()
    text = data.get('text')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400

    if not SPEECH_KEY or not SPEECH_REGION:
        return jsonify({"error": "Speech API credentials not configured"}), 500

    try:
        # Generate a unique filename
        filename = f"audio_{uuid.uuid4().hex[:8]}.wav"
        filepath = os.path.join('static', filename)
        
        speech_config = speechsdk.SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_REGION)
        # Using a nice, natural-sounding voice
        speech_config.speech_synthesis_voice_name = 'en-US-JennyNeural'
        
        audio_config = speechsdk.audio.AudioOutputConfig(filename=filepath)
        speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
        
        result = speech_synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return jsonify({"success": True, "audio_url": f"/static/{filename}"})
        elif result.reason == speechsdk.ResultReason.Canceled:
            cancellation_details = result.cancellation_details
            return jsonify({"error": f"Speech synthesis canceled: {cancellation_details.reason}"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stt', methods=['POST'])
def speech_to_text():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    if not audio_file.filename:
        return jsonify({"error": "Empty filename"}), 400

    if not SPEECH_KEY or not SPEECH_REGION:
        return jsonify({"error": "Speech API credentials not configured"}), 500

    try:
        filename = f"temp_{uuid.uuid4().hex[:8]}.wav"
        filepath = os.path.join('static', filename)
        audio_file.save(filepath)
        
        speech_config = speechsdk.SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_REGION)
        speech_config.speech_recognition_language = "en-US"
        audio_config = speechsdk.audio.AudioConfig(filename=filepath)
        speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
        
        result = speech_recognizer.recognize_once_async().get()
        
        # Free resources so Windows unlocks the file
        del speech_recognizer
        del audio_config
        
        import time
        time.sleep(0.1) # Brief pause to ensure OS releases lock
        
        # Clean up temporary file gracefully
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
            
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return jsonify({"success": True, "text": result.text})
        elif result.reason == speechsdk.ResultReason.NoMatch:
            return jsonify({"error": "Speech could not be recognized. Please try speaking clearer."}), 400
        elif result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            if "SPXERR_INVALID_HEADER" in str(details.error_details):
                return jsonify({"error": "Geçersiz ses formatı. Eğer dosya yüklediysen, lütfen sadece standart bir .WAV dosyası yükle veya mikrofonla kaydetmeyi tekrar dene."}), 400
            return jsonify({"error": f"Speech canceled: {details.error_details}"}), 500
            
    except Exception as e:
        error_msg = str(e)
        if "SPXERR_INVALID_HEADER" in error_msg:
             return jsonify({"error": "Geçersiz ses formatı (Invalid Header). Eğer Dosya Seç diyerek dosya yüklediyseniz lütfen geçerli bir .WAV formatında dosya yükleyin!"}), 400
        return jsonify({"error": error_msg}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

