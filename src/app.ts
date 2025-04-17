import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import swaggerUI from 'swagger-ui-express'
import swaggerJSdoc from 'swagger-jsdoc'
import dotenv from 'dotenv'
import connectDB from './config/database'

// Load environment variables
dotenv.config();

import petRoutes from './pets/routes/pets.route'
import userRoutes from './users/routes/users.route'
import paystackRoutes from './donations/routes/donations.route'

const app = express()
const port = process.env.PORT || 3000

// swagger definition
const swaggerSpec: swaggerJSdoc.Options = {
    failOnErrors: true,
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Pets API',
            version: '1.0.0',
        },
        servers: [
            {
                url: `http://localhost:${port}`,
            }
        ]
    },
    apis: ['./dist/pets/routes/*.js','./dist/users/routes/*.js'],
}

/* Global middlewares */
app.use(cors({
    origin: [
        "https://petty-store.vercel.app",
        "https://bear-deciding-wren.ngrok-free.app", 
        "https://v6grnb13-5173.uks1.devtunnels.ms",
        process.env.FRONTEND_URL || 'http://localhost:5173', 
        process.env.FRONTEND_URL_DEV || 'http://localhost:4173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['set-cookie']
}));

app.set('trust proxy', 1);

app.use(cookieParser());
app.use(express.json())

app.use(
    '/api-docs',
    swaggerUI.serve,
    swaggerUI.setup(swaggerJSdoc(swaggerSpec))
);

// Initialize server with database connection
const startServer = async () => {
    try {
        await connectDB();
        console.log('Database connected successfully');

        /* Routes */
        app.use('/donations', paystackRoutes)
        app.use('/pets', petRoutes)
        app.use('/users', userRoutes)

        app.get('*', (req: Request, res: Response) => {
            res.send("<h1>Hello</h1>")
        })

        app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
            console.error(err);
            res.status(500).json({ 
                message: 'Internal server error', 
                error: err.message || 'Unknown error' 
            });
        });

        if (process.env.NODE_ENV !== 'test') {
            app.listen(port, () => {
                console.log(`⚡️[server]: Server is running at https://localhost:${port}`)
            });
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app