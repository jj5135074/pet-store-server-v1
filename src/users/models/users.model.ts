import fs from 'fs'
import path from 'path'
import { jwtVerify } from 'jose';
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import users from '../../../users.json'
import tkn from '../../../pwd.json'
import signInTokens from '../../../signins.json'
import { User } from '../../types/type'
import { SignJWT } from "jose";
import { UAParser } from 'ua-parser-js'
import { Response, Request } from 'express';
import { callSuccess, emailChangedNotification, sendCodeByEmail } from '../../utils/email'

export async function verifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}

export interface Payload {
    _id: string,
    exp: number
}

interface Obj {
    id: string;
    resetToken: string;
    resetTokenExpiry: Date;
}
interface ConfirmationRecord {
    id: string;
    confirmationCode: string;
    confirmationExpiry: Date;
}

interface SignInTokens {
    userId: string,
    token: string,
    deviceInfo: UAParser.IResult,
    createdAt: string
}

const db = {
    users: users as unknown as User[],
    tokens: tkn.filter((token) => Object.keys(token).includes('resetToken')
    ) as unknown as Obj[],
    confirmations: tkn.filter((token) => !Object.keys(token).includes('resetToken')
    ) as unknown as ConfirmationRecord[],
    signInTokens: signInTokens as SignInTokens[]
}

fs.watchFile(path.join(__dirname, '.../../../users.json'), (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      db.users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../users.json')).toString());
      console.log('users.json updated');
    }
});

fs.watchFile(path.join(__dirname, '.../../../pwd.json'), (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        db.tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../pwd.json')).toString()).filter((token: Obj) => {
            Object.keys(token).includes('resetToken')
        }) as Obj[];
        db.confirmations = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../pwd.json')).toString()).filter((token: ConfirmationRecord) => {
            !Object.keys(token).includes('resetToken')
        }) as ConfirmationRecord[];
        console.log('pwd.json updated');
    }
});

fs.watchFile(path.join(__dirname, '.../../../signins.json'), (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      db.signInTokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../signins.json')).toString());
      console.log('signins.json updated');
    }
});

const saltRounds = 10;

export function secretKey(){
    return crypto.randomBytes(10).toString('hex');
}

function generateRandom16DigitNumber(): string {
    let randomNumber = '';
    for (let i = 0; i < 24; i++) {
      randomNumber += Math.floor(Math.random() * 10).toString();
    }
    return randomNumber;
}

function Write() {
    fs.writeFileSync(path.join(__dirname, '../../../users.json'), JSON.stringify(db.users, null, 2))
}

function WriteTokens(arg0: 't' | 'c' | 's') {
    fs.writeFileSync(path.join(__dirname, '../../../pwd.json'), JSON.stringify(arg0 === 't' ? db.tokens : db.confirmations, null, 2))
}

function WriteSignInTokens() {
    fs.writeFileSync(path.join(__dirname, '../../../signins.json'), JSON.stringify(db.signInTokens, null, 2))
}

// Users

export const getUser = async (email: string, password: string, headers: any) => {
    try {
        const expirationTime = new Date();
        expirationTime.setDate(expirationTime.getDate() + 1);

        const user = db?.users?.find((user: User) => user?.email === email)
        if(!user) throw new Error('User not found')
        // console.log(user.password, password)
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            throw Error('Invalid password');
        }
        delete (user as Partial<User>).password

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const token = await new SignJWT({ _id: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15d')
        .sign(secret);
        
        // Extract device information
        const parser = new UAParser(headers);
        const deviceInfo = parser.getResult();
        
        db.signInTokens.push({
            userId: user.id,
            token,
            deviceInfo,
            createdAt: new Date().toISOString()
        });

        WriteSignInTokens()

        return {user,expirationTime,token}
    } catch (err) {
        console.log('Error', err)
        throw err
    }
}

export const listUsers = () => {
    try {
        return db?.users
    } catch (err) {
        console.log('Error', err)
    }
}

export const findUser = async (id: string) => {
    try {
        const user = db?.users.find(user => user.id === id)
        if(!user) throw new Error('User not found')
        delete (user as Partial<User>).password
        return user
    } catch (err) {
        throw err
    }
}

export const editUser = async (id: string, data: User & { oldPassword: string }) => {
    try {
        const index = db.users.findIndex((user: User)  => user.id === id)

        if (index === -1) throw new Error('User not found')
        else {
            if(Object.keys(data).includes("password")) {
                const passwordMatch = data.oldPassword && db.users[index].password ? await bcrypt.compare(data.oldPassword, db.users[index].password) : false;
                if (!passwordMatch) {
                    throw Error('Invalid password');
                }
                const hashedPassword = await bcrypt.hash(data.password, saltRounds);
                db.users[index] = { ...db.users[index], password: hashedPassword}
            } else {
                db.users[index] = {...db.users[index], ...data}
            }
            Write()
            delete (db.users[index] as Partial<User>).password
            return db.users[index]
        }        
    } catch (err) {
        console.log('Error', err)
        throw err
    }
}

export const addUser = async (req: Request) => {
    try {
        const { body: data } = req;
        
        const dbCheck = db.users.some((user: User)  => user.email === data.email)
        if(dbCheck){
            throw new Error('Email already exists');
        }

        const expirationTime = new Date();
        expirationTime.setDate(expirationTime.getDate() + 1);

        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        const newUser = { ...data, password: hashedPassword}
        db.users.push(newUser)
        Write()


        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const token = await new SignJWT({ _id: newUser.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15d')
        .sign(secret);
        
        // Extract device information
        const parser = new UAParser(req.headers['user-agent']);
        const deviceInfo = parser.getResult();

        db.signInTokens.push({
            userId: newUser.id,
            token,
            deviceInfo,
            createdAt: new Date().toISOString()
        });

        WriteSignInTokens()

        await callSuccess( newUser.firstName, newUser.lastName, newUser.email )

        delete newUser.password
        return {newUser, expirationTime, token}

    } catch (err) {
        throw err
    }
}

export const deleteUser = (id: string) => {
    try {
        // delete User from db
        const index = db.users.findIndex((user: User)  => user.id === id)

        if (index === -1) throw new Error('User not found')
        else {
            db.users.splice(index, 1)
            Write()
            return true
        }
    } catch (error) {
        console.log('Error', error)
    }
}

export const updateUserResetToken = async (
    email: string, 
    resetToken: string, 
    resetTokenExpiry: Date
): Promise<void> => {
    try {
        const user = users.find(u => u.email === email);
        if (!user) {
            throw new Error('User not found');
        }

        const obj = { id: user.id, resetToken: resetToken, resetTokenExpiry: resetTokenExpiry}
        db.tokens.push(obj)
        WriteTokens('t')
    } catch (err) {
        throw err
    }
};

export const verifyResetTokenAndUpdatePassword = async (
    resetToken: string,
    newPassword: string
): Promise<void> => {
    try {
        const tokenRecord = db.tokens.find(t => t.resetToken === resetToken);
        if (!tokenRecord) {
            throw new Error('Invalid or expired reset token');
        }

        // Check if token is expired
        if (new Date() > new Date(tokenRecord.resetTokenExpiry)) {
            throw new Error('Reset token has expired');
        }

        // Find user and update password
        const user = db.users.find(u => u.id === tokenRecord.id);
        if (!user) {
            throw new Error('User not found');
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        user.password = hashedPassword;

        // Remove the used token
        const tokenIndex = db.tokens.findIndex(t => t.resetToken === resetToken);
        db.tokens.splice(tokenIndex, 1);

        // Save changes
        Write();
        WriteTokens('t')
    } catch (err) {
        throw err
    }
};

export const sendEmailConfirmationCode = async (
    email: string
): Promise<string> => {
    try {
        const user = db.users.find(u => u.email === email);
        if (!user) {
            throw new Error('User not found');
        }

        // Generate a random 6-digit confirmation code
        const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store the confirmation code with expiry (30 minutes from now)
        const confirmationExpiry = new Date(Date.now() + 30 * 60 * 1000);
        const confirmationRecord = {
            id: user.id,
            confirmationCode,
            confirmationExpiry
        };

        // Add or update confirmation record
        const existingIndex = db.confirmations.findIndex(c => c.id === user.id);
        if (existingIndex >= 0) {
            db.confirmations[existingIndex] = confirmationRecord;
        } else {
            db.confirmations.push(confirmationRecord);
        }

        // Save to file
        WriteTokens('c')
        await sendCodeByEmail( user.firstName, user.lastName, user.email, confirmationCode )

        return 'Sent';
    } catch (err) {
        throw err
    }
};

export const verifyEmailConfirmationCode = async (
    email: string,
    code: string
): Promise<(string | boolean)[]> => {
    try {
        const user = db.users.find(u => u.email === email);
        if (!user) {
            throw new Error('User not found');
        }

        // Find confirmation record for user
        const confirmationRecord = db.confirmations.find(c => c.id === user.id);
        if (!confirmationRecord) {
            throw new Error('No confirmation code found');
        }

        // Check if code has expired
        if (new Date() > new Date(confirmationRecord.confirmationExpiry)) {
            // Remove expired confirmation record
            const index = db.confirmations.findIndex(c => c.id === user.id);
            db.confirmations.splice(index, 1);
            WriteTokens('c')
            throw new Error('Confirmation code has expired');
        }

        // Verify code matches
        if (confirmationRecord.confirmationCode !== code) {
            throw new Error('Invalid confirmation code');
        }

        // Remove used confirmation record
        const index = db.confirmations.findIndex(c => c.id === user.id);
        db.confirmations.splice(index, 1);
        WriteTokens('c')

        // Update user's email verification status
        user.verificationStatus.emailVerified = true;
        user.accountDetails.lastUpdated = new Date().toISOString();
        Write();
        await emailChangedNotification( user.firstName, user.lastName, user.email )

        const newData = [true,user.accountDetails.lastUpdated]
        return newData;
    } catch (err) {
        throw err
    }
};