var apiUrl = 'https://ns4.codehelpers.io';
document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData();
    const files = document.getElementById('images').files;
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    formData.append('width', document.getElementById('width').value);
    formData.append('height', document.getElementById('height').value);
    formData.append('fit', document.getElementById('fit').value);
    formData.append('background', document.getElementById('background').value);

    const response = await fetch(apiUrl + '/upload', {
        method: 'POST',
        body: formData
    });
    const result = await response.json();
    displayImages(result.images, result.folder);
});

function displayImages(images, folder) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    images.forEach(image => {
        image = apiUrl + image;
        const img = document.createElement('img');
        img.src = image;
        img.setAttribute('data-src', image);
        img.classList.add('img-thumbnail', 'm-2');
        resultDiv.appendChild(img);
    });
    document.getElementById('downloadButton').style.display = 'block';
    document.getElementById('downloadButton').dataset.folder = folder;
}

document.getElementById('downloadButton').addEventListener('click', async function () {
    const folder = this.dataset.folder;
    const response = await fetch(`${apiUrl}/download-zip/${folder}`, {
        method: 'GET'
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'resized-images.zip';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
});
