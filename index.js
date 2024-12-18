const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Storage setup for multer
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// List of people with photos
let people = {
    'Chris': { code: 'chris123', photo: '' },
    'Pacco': { code: 'pacco123', photo: '' },
    'May': { code: 'may123', photo: '' },
    'Justin': { code: 'justin123', photo: '' }
};

let lastUpdate = 'Never';
let loginLogs = []; // Array to store log entries

// Function to shuffle an array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to create gift assignments ensuring no one receives their own gift
function createGiftAssignments(people) {
    let names = Object.keys(people);
    let shuffledNames = shuffle([...names]);
    let assignments = {};

    // Check for self-assignment and adjust if necessary
    for (let i = 0; i < names.length; i++) {
        if (names[i] === shuffledNames[i]) {
            const swapIndex = (i === names.length - 1) ? 0 : i + 1;
            [shuffledNames[i], shuffledNames[swapIndex]] = [shuffledNames[swapIndex], shuffledNames[i]];
        }
        assignments[names[i]] = shuffledNames[i];
    }

    return assignments;
}

// Create assignments
let giftAssignments = createGiftAssignments(people);

// Endpoint to get current people data
app.get('/api/admin/people', (req, res) => {
    const peopleArray = Object.keys(people).map(name => ({
        name,
        code: people[name].code,
        photo: people[name].photo
    }));
    res.json({ people: peopleArray, lastUpdate });
});

// Endpoint to retrieve login logs
app.get('/api/admin/logs', (req, res) => {
    res.json(loginLogs);
});

// Update the gift assignment endpoint to log code usage
app.get('/api/gift/:code', (req, res) => {
    const code = req.params.code.toLowerCase();
    const person = Object.keys(people).find(key => people[key].code === code);
    if (person) {
        const receiver = giftAssignments[person];
        loginLogs.push({
            user: person,
            time: new Date().toLocaleString()
        });
        console.log(`Log added: ${person} at ${new Date().toLocaleString()}`);
        res.json({ receiver, photo: people[receiver].photo });
    } else {
        res.status(404).json({ error: 'Code not found' });
    }
});

// Admin login (simple for demonstration)
const adminCredentials = { username: 'admin', password: 'password' };

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminCredentials.username && password === adminCredentials.password) {
        res.redirect('/admin-dashboard');
    } else {
        res.status(401).send('Unauthorized');
    }
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// New endpoint to handle adding new members
app.post('/admin/add-member', upload.single('photo'), (req, res) => {
    const { name, code } = req.body;
    if (people[name]) {
        return res.status(400).send('Member already exists');
    }
    const photo = req.file ? `/uploads/${req.file.filename}` : '';
    people[name] = { code, photo };
    giftAssignments = createGiftAssignments(people);
    lastUpdate = new Date().toLocaleString();
    res.sendStatus(200);
});

// New endpoint to handle deleting a member
app.delete('/admin/delete-member/:name', (req, res) => {
    const name = req.params.name;
    if (people[name]) {
        delete people[name];
        giftAssignments = createGiftAssignments(people);
        lastUpdate = new Date().toLocaleString();
        res.sendStatus(200);
    } else {
        res.status(404).send('Member not found');
    }
});

// New endpoint to handle bulk updates
app.post('/admin/update-all', upload.fields(Object.keys(people).map(name => ({ name: `photo-${name}` }))), (req, res) => {
    Object.keys(people).forEach(name => {
        const newCode = req.body[`code-${name}`];
        if (newCode) {
            people[name].code = newCode;
        }
        if (req.files[`photo-${name}`]) {
            people[name].photo = `/uploads/${req.files[`photo-${name}`][0].filename}`;
        }
    });
    giftAssignments = createGiftAssignments(people);
    lastUpdate = new Date().toLocaleString();
    res.sendStatus(200);
});

// Serve the log page
app.get('/admin/logs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'log.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});