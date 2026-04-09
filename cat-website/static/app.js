document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const classifyBtn = document.getElementById('classifyBtn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    const resultArea = document.getElementById('resultArea');
    const primaryLabel = document.getElementById('primaryLabel');
    const confidenceBar = document.getElementById('confidenceBar');
    const primaryConfidence = document.getElementById('primaryConfidence');

    let selectedFile = null;

    // Handle Drag and Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Handle file input click
    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        
        selectedFile = file;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
            classifyBtn.disabled = false;
            resultArea.classList.add('hidden'); // hide previous results
        };
        
        reader.readAsDataURL(file);
    }

    // Handle Classify Button Click
    classifyBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI Loading state
        classifyBtn.disabled = true;
        btnText.textContent = "Analyzing...";
        loader.classList.remove('hidden');
        resultArea.classList.add('hidden');

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await fetch('/classify', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Server error');
            }

            // Display Results
            let label = data.primary_prediction.replace(/_/g, ' ');
            primaryLabel.textContent = label;
            
            const confPercent = (data.primary_confidence * 100).toFixed(1);
            primaryConfidence.textContent = confPercent;
            
            resultArea.classList.remove('hidden');
            
            // Animate confidence bar
            setTimeout(() => {
                confidenceBar.style.width = `${confPercent}%`;
            }, 100);

        } catch (error) {
            alert('Error classifying image: ' + error.message);
        } finally {
            // Revert UI Loading State
            classifyBtn.disabled = false;
            btnText.textContent = "Classify Cat";
            loader.classList.add('hidden');
        }
    });
});
