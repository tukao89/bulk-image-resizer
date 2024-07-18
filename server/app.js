const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(__dirname + '/uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const cleanFileName = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '');
        cb(null, `${cleanFileName}`);
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.array('images'), async (req, res) => {
    try {
        const { width, height, fit, background } = req.body;
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const folderName = uuidv4();
        const uniqueFolder = `uploads/${folderName}`;
        const resizedFolder = path.join(uniqueFolder, 'resized');
        if (!fs.existsSync(resizedFolder)) {
            fs.mkdirSync(resizedFolder, { recursive: true });
        }

        const resizedImages = [];
        for (const file of files) {
            const outputPath = path.join(resizedFolder, `${file.filename}.png`);
            const sharpInstance = sharp(file.path).resize({
                width: width ? parseInt(width) : null,
                height: height ? parseInt(height) : null,
                fit: fit,
                background: background ? background : { r: 255, g: 255, b: 255, alpha: 1 }
            }).png({ quality: 100 });

            await sharpInstance.toFile(outputPath);
            resizedImages.push(`/${outputPath}`);
            fs.unlinkSync(file.path); // Remove the original file
        }

        res.json({ images: resizedImages, folder: folderName });
    } catch (error) {
        console.error('Error processing images:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/download-zip/:folder', (req, res) => {
    const folder = req.params.folder;
    const zipPath = path.join(__dirname, 'uploads', `${folder}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', () => {
        res.download(zipPath, `${folder}.zip`, (err) => {
            if (err) {
                console.error('Error downloading zip:', err);
                res.status(500).send('Internal Server Error');
            }
            fs.unlinkSync(zipPath); // Clean up the zip file
        });
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    const resizedFolder = path.join(__dirname, 'uploads', folder, 'resized');
    fs.readdir(resizedFolder, (err, files) => {
        if (err) {
            throw err;
        }
        files.forEach(file => {
            archive.file(path.join(resizedFolder, file), { name: file });
        });
        archive.finalize();
    });
});

// Schedule a cron job to delete old files (older than 1 hour) each 5 minutes
cron.schedule('*/5 * * * *', () => {
    const uploadsDir = path.join(__dirname, 'uploads');
    const now = Date.now();
    const expiryTime = 1 * 60 * 60 * 1000; // 1 hour

    fs.readdir(uploadsDir, (err, files) => {
        if (err) throw err;

        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) throw err;

                if (now - stats.mtimeMs > expiryTime) {
                    fs.rm(filePath, { recursive: true, force: true }, (err) => {
                        if (err) throw err;
                        console.log(`Deleted old file: ${filePath}`);
                    });
                }
            });
        });
    });
});

const PORT = 7004;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



