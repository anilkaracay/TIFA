import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
    res.send('Hello from TIFA Backend!');
});

app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
});
