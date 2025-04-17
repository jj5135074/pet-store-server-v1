import fs from 'fs'
import path from 'path'
import dbb from '../../../db.json'
import { PetProfile } from '../../types/type'

let db = {
    pets: dbb as PetProfile[]
}
 
// const dbb = fs.readFileSync(path.join(__dirname, '../../../db.json'));
if (dbb.length === 0) {
    console.log('Pets file is empty. Initializing with default values.');
}
// db.pets = JSON.parse(dbb.toString()); 

export const getItem = (id: string) => {
    try {
        const pet = db?.pets?.filter((pet: PetProfile) => pet?.id === id)[0]
        return pet
    } catch (err) {
        console.log('Error', err)
    }
}

export const getItems = (query: string) => {
    try {
        const filteredPets = db?.pets?.filter((pet: PetProfile) => {
            const searchTerm = query?.toLowerCase() || '';
            return pet.type.toLowerCase().includes(searchTerm) ||
                   pet.breed.toLowerCase().includes(searchTerm) ||
                   pet.name.toLowerCase().includes(searchTerm) ||
                   pet.status.toLowerCase().includes(searchTerm);
        });
        if (filteredPets.length === 0) return null;
        else return filteredPets;
    } catch (err) {
        console.log('Error', err)
    }
}

export const listItems = () => {
    try {
        return db?.pets
    } catch (err) {
        console.log('Error', err)
    }
}

export const editItem = (id: string, data: PetProfile) => {
    try {
        const index = db.pets.findIndex((pet: PetProfile)  => pet.id === id)

        if (index === -1) throw new Error('Pet not found')
        else {
            db.pets[index] = data
            fs.writeFileSync(path.join(__dirname, '../../../db.json'), JSON.stringify(db.pets, null, 2))
            return db.pets[index]
        }        
    } catch (err) {
        console.log('Error', err)
    }
}

export const addItem = (data: any) => {
    try {  
        const newPet = { id: db.pets.length + 1, ...data }
        db.pets.push(newPet)
        fs.writeFileSync(path.join(__dirname, '../../../db.json'), JSON.stringify(db.pets, null, 2))
        return newPet

    } catch (err) {
        console.log('Error', err)
    }
}

export const deleteItem = (id: string) => {
    try {
        // delete item from db
        const index = db.pets.findIndex((pet: PetProfile)  => pet.id === id)

        if (index === -1) throw new Error('Pet not found')
        else {
            db.pets.splice(index, 1)
            fs.writeFileSync(path.join(__dirname, '../../../db.json'), JSON.stringify(db.pets, null, 2))
            return db.pets
        }
    } catch (error) {
        console.log('Error', error)
    }
}