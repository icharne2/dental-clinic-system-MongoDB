from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv
import jwt
import bcrypt
from typing import Optional, List, Any
from datetime import datetime


load_dotenv()
app = FastAPI(title="Dentica Final Management API")

SECRET_KEY = "dentica-super-secret-key-2026-fixed-length-32"
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/"))
db = client[os.getenv("DB_NAME", "dentica_db")]


def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("role") != 'admin':
            raise Exception("Brak roli admina")
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Sesja wygasła lub błąd klucza. Zaloguj się ponownie.")


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except:
        raise HTTPException(status_code=401)


@app.get("/admin/appointments")
def admin_get_all_apps(admin=Depends(get_current_admin)):
    cursor = db.appointments.find().sort("slot_date", -1)
    return [serialize_doc(d) for d in cursor]


@app.get("/admin/patients")
def admin_get_patients(admin=Depends(get_current_admin)):
    cursor = db.users.find({"role": "patient"})
    return [serialize_doc(d) for d in cursor]


@app.post("/admin/dentists")
async def admin_add_dentist(request: Request, admin=Depends(get_current_admin)):
    data = await request.json()
    new_doc = {
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "specialization": data.get("specialization"),
        "email": data.get("email"),
        "phone_number": data.get("phone_number"),
        "services": []
    }
    db.dentists.insert_one(new_doc)
    return {"message": "OK"}


@app.delete("/admin/dentists/{dentist_id}")
def admin_delete_dentist(dentist_id: str, admin=Depends(get_current_admin)):
    if not ObjectId.is_valid(dentist_id): raise HTTPException(status_code=400)
    db.appointments.delete_many({"dentist_id": dentist_id})
    db.available_slots.delete_many({"dentist_id": dentist_id})
    db.dentists.delete_one({"_id": ObjectId(dentist_id)})
    return {"message": "OK"}


@app.post("/admin/services")
async def admin_add_service(request: Request, admin=Depends(get_current_admin)):
    data = await request.json()
    d_id = data.get("dentist_id")
    if not d_id or not ObjectId.is_valid(str(d_id)):
        raise HTTPException(status_code=400, detail="Błędne ID lekarza")

    new_service = {
        "id": str(ObjectId()),
        "name": str(data.get("name")).upper(),
        "price": str(data.get("price"))
    }
    db.dentists.update_one({"_id": ObjectId(d_id)}, {"$push": {"services": new_service}})
    return {"message": "OK"}


@app.delete("/admin/services/{dentist_id}/{service_id}")
def admin_delete_service(dentist_id: str, service_id: str, admin=Depends(get_current_admin)):
    if not ObjectId.is_valid(dentist_id):
        raise HTTPException(status_code=400, detail="Błędne ID lekarza")

    result = db.dentists.update_one(
        {"_id": ObjectId(dentist_id)},
        {"$pull": {"services": {"id": service_id}}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nie znaleziono lekarza")
    return {"message": "OK"}


@app.post("/admin/slots")
async def admin_add_slot(request: Request, admin=Depends(get_current_admin)):
    data = await request.json()
    d_id = data.get("dentist_id")
    if not d_id or not ObjectId.is_valid(str(d_id)):
        raise HTTPException(status_code=400, detail="Wybierz lekarza")

    dentist = db.dentists.find_one({"_id": ObjectId(d_id)})
    db.available_slots.insert_one({
        "dentist_id": d_id,
        "dentist_name": dentist["last_name"],
        "slot_date": data.get("slot_date"),
        "start_time": data.get("start_time"),
        "is_available": True,
        "service_name": data.get("service_id")
    })
    return {"message": "OK"}

@app.delete("/admin/cancel/{appointment_id}/{slot_id}")
def admin_cancel_appointment(appointment_id: str, slot_id: str, admin=Depends(get_current_admin)):
    if not ObjectId.is_valid(appointment_id) or not ObjectId.is_valid(slot_id):
        raise HTTPException(status_code=400)

    db.appointments.delete_one({"_id": ObjectId(appointment_id)})
    db.available_slots.update_one({"_id": ObjectId(slot_id)}, {"$set": {"is_available": True}})
    return {"message": "OK"}


@app.get("/dentists")
def get_dentists():
    return [serialize_doc(d) for d in db.dentists.find()]


@app.get("/slots")
def get_slots():
    today = datetime.now().strftime("%Y-%m-%d")
    query = {"is_available": True, "slot_date": {"$gte": today}}
    cursor = db.available_slots.find(query).sort([("slot_date", 1), ("start_time", 1)])
    return [serialize_doc(d) for d in cursor]


@app.get("/appointments")
def get_user_appointments(user_id: str = Depends(get_current_user_id)):
    cursor = db.appointments.find({"user_id": user_id}).sort("slot_date", 1)
    return [serialize_doc(d) for d in cursor]


@app.post("/book/{slot_id}")
def book_appointment(slot_id: str, user_id: str = Depends(get_current_user_id)):
    # walidacja ID
    if not ObjectId.is_valid(slot_id): raise HTTPException(status_code=400)

    # sprawdzenie czy slot nadal jest wolny
    slot = db.available_slots.find_one({"_id": ObjectId(slot_id), "is_available": True})
    if not slot: raise HTTPException(status_code=400, detail="Termin już zajęty")

    # pobranie danych pacjenta
    user = db.users.find_one({"_id": ObjectId(user_id)})

    # zmiana statusu slotu na zajęty
    db.available_slots.update_one({"_id": ObjectId(slot_id)}, {"$set": {"is_available": False}})

    # utworzenie potwierdzonej wizyty
    db.appointments.insert_one({
        "user_id": user_id,
        "patient_name": f"{user['first_name']} {user['last_name']}",
        "dentist_id": slot["dentist_id"],
        "dentist_name": slot["dentist_name"],
        "slot_id": slot_id,
        "slot_date": slot["slot_date"],
        "start_time": slot["start_time"],
        "service_name": slot.get("service_name", "Konsultacja")
    })
    return {"message": "OK"}


@app.post("/login")
async def login(request: Request):
    data = await request.json()
    # Szukanie użytkownika w bazie po adresie e-mail
    user = db.users.find_one({"email": data.get("email", "").strip()})

    # czy użytkownik istnieje i czy hasło jest poprawne
    if user and bcrypt.checkpw(data.get("password").encode('utf-8'), user['password_hash'].encode('utf-8')):
        # generowanie tokena JWT
        token = jwt.encode(
            {
                "user_id": str(user['_id']),
                "role": user['role'],
                "exp": datetime.utcnow().timestamp() + 86400  # Token ważny 24h
            },
            SECRET_KEY, algorithm="HS256"
        )

        # przeslanie danych do frontendu
        return {"token": token, "role": user['role'], "name": user['first_name']}

    raise HTTPException(status_code=401, detail="Błędne dane logowania")

@app.post("/register")
async def register(request: Request):
    data = await request.json()

    # szyfrowanie hasła
    hashed = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # zapis nowego dokumentu w kolekcji users
    db.users.insert_one({
        "first_name": data['first_name'],
        "last_name": data['last_name'],
        "email": data['email'].strip(),
        "password_hash": hashed,
        "role": "patient"
    })
    return {"message": "OK"}