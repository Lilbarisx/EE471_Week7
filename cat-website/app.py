import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
# Cog API runs on port 5000 by default. Since we will run this separate container, 
# we need to be able to contact the model container. On Windows/Docker Desktop, we use host.docker.internal
COG_URL = os.environ.get('COG_URL', 'http://host.docker.internal:5000/predictions')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/classify', methods=['POST'])
def classify():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Send the file to Cog Predictor API
        files = {'image': (file.filename, file.stream, file.mimetype)}
        # Cog API expects multipart/form-data for files in the /predictions endpoint automatically parsed if input type is Path
        # Wait, the format for generic cog predictions endpoint is POST to /predictions
        # With form data containing the inputs. Wait, the official cog format is:
        # We can POST a file to /predictions directly? No, the documentation says:
        # Send a POST with {"input": {"image": "data:image/jpeg;base64,..."}} OR
        # for HTTP API, Cog supports multipart file uploads directly!
        
        # Actually, wait. It's safer to use base64 if we want absolute reliability with generic HTTP requests to cog.
        import base64
        file_bytes = file.read()
        base64_encoded = base64.b64encode(file_bytes).decode('utf-8')
        mime_type = file.mimetype
        data_uri = f"data:{mime_type};base64,{base64_encoded}"

        payload = {
            "input": {
                "image": data_uri
            }
        }

        response = requests.post(COG_URL, json=payload)
        response.raise_for_status()
        cog_result = response.json()
        
        # The result from our predict.py is in cog_result["output"] which is a JSON string
        import json
        output_str = cog_result.get("output")
        if output_str:
            final_result = json.loads(output_str)
            return jsonify(final_result)
        else:
            return jsonify({'error': 'Model returned invalid format', 'raw': cog_result}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
