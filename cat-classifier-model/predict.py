# Prediction interface for Cog ⚙️
# https://github.com/replicate/cog/blob/main/docs/python.md

from cog import BasePredictor, Input, Path
import torch
from torchvision import models, transforms
from PIL import Image
import json

class Predictor(BasePredictor):
    def setup(self):
        """Load the model into memory to make running multiple predictions efficient"""
        self.model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
        self.model.eval()
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])
        
        # Load ImageNet class labels (ResNet50 is trained on ImageNet)
        # We fetch the labels from the torchvision meta
        self.categories = models.ResNet50_Weights.DEFAULT.meta["categories"]

    def predict(
        self,
        image: Path = Input(description="Grayscale or RGB image to classify")
    ) -> str:
        """Run a single prediction on the model"""
        img = Image.open(str(image)).convert("RGB")
        input_tensor = self.transform(img)
        input_batch = input_tensor.unsqueeze(0)

        with torch.no_grad():
            output = self.model(input_batch)

        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        top5_prob, top5_catid = torch.topk(probabilities, 5)

        # We will return the top prediction that sounds like a cat, or the absolute top prediction
        results = []
        for i in range(top5_prob.size(0)):
            results.append({
                "label": self.categories[top5_catid[i]],
                "confidence": float(top5_prob[i].item())
            })
        
        # The frontend wants a simple answer, let's just return a JSON string
        return json.dumps({
            "primary_prediction": results[0]["label"],
            "primary_confidence": results[0]["confidence"],
            "top_5": results
        })
