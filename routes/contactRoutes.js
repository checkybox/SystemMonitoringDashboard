import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle contact form submission
router.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).send('<h2>Error: All fields (name, email, message) are required.</h2>');
    }

    const contactData = {
        name,
        email,
        message,
        timestamp: new Date().toISOString()
    };

    const filePath = path.join(__dirname, '../contact-submissions.json');

    let submissions = [];
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            submissions = JSON.parse(fileContent);
        } catch (err) {
            console.error('Error reading existing submissions:', err);
        }
    }

    submissions.push(contactData);

    fs.writeFile(filePath, JSON.stringify(submissions, null, 2), (err) => {
        if (err) {
            console.error('Error saving contact form:', err);
            return res.status(500).send('<h2>Error saving your message. Please try again.</h2>');
        }

        console.log('Contact form saved:', contactData);
        res.send(`<h2>Thanks, ${name}! Your message has been received and saved.</h2>`);
    });
});

export default router;

