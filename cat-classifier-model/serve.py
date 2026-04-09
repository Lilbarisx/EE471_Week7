from flask import Flask, request, jsonify
import sys
from predict import Predictor
from pathlib import Path
import tempfile
import base64

app = Flask(__name__)

# Initialize the model as cog would
predictor = Predictor()
predictor.setup()

@app.route('/predictions', methods=['POST'])
def predict_endpoint():
    data = request.json
    try:
        # In cog, HTTP API payload contains base64 data under input image
        image_data = data['input']['image']
        
        # cog format is data:image/jpeg;base64,.....
        header, encoded = image_data.split(",", 1)
        decoded = base64.b64decode(encoded)
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as t:
            t.write(decoded)
            t_path = Path(t.name)
            
        result = predictor.predict(t_path)
        
        # return properly formatted json output
        return jsonify({"output": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
