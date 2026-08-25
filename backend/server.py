from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import asyncio
import logging
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, BeforeValidator
from typing import List, Optional, Annotated
from datetime import datetime, timezone
from bson import ObjectId
from user_agents import parse as parse_ua
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(str)]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class TrackLink(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    short_code: str
    original_url: str
    title: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    click_count: int = 0

    model_config = {"populate_by_name": True}


class LinkCreate(BaseModel):
    original_url: str
    title: Optional[str] = None


class LocationRecord(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    short_code: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    method: str = "gps"  # gps | ip
    place: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None   # mobile | tablet | desktop | bot
    device_brand: Optional[str] = None
    device_model: Optional[str] = None
    os: Optional[str] = None
    browser: Optional[str] = None
    dispatch_status: str = "pending"  # pending | dispatched | delivered | unreachable
    notes: Optional[str] = None
    timestamp: str = Field(default_factory=now_iso)

    model_config = {"populate_by_name": True}


class TrackCreate(BaseModel):
    short_code: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    method: str = "gps"


class RecordUpdate(BaseModel):
    dispatch_status: Optional[str] = None
    notes: Optional[str] = None


# ---------- Helpers ----------
def serialize(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def parse_device(ua_string):
    if not ua_string:
        return {}
    try:
        ua = parse_ua(ua_string)
        if ua.is_mobile:
            dtype = "mobile"
        elif ua.is_tablet:
            dtype = "tablet"
        elif ua.is_bot:
            dtype = "bot"
        else:
            dtype = "desktop"
        os_str = " ".join(filter(None, [ua.os.family, ua.os.version_string])).strip() or None
        browser_str = " ".join(filter(None, [ua.browser.family, ua.browser.version_string])).strip() or None
        brand = ua.device.brand if ua.device.brand and ua.device.brand != "Other" else None
        model = ua.device.model if ua.device.model and ua.device.model != "Other" else None
        return {
            "device_type": dtype,
            "device_brand": brand,
            "device_model": model,
            "os": os_str,
            "browser": browser_str,
        }
    except Exception as e:
        logging.warning(f"parse_device failed: {e}")
        return {}


def get_client_ip(request: Request) -> Optional[str]:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def reverse_geocode(lat, lng):
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json", "zoom": 14},
            headers={"User-Agent": "GeoReachAid/1.0"},
            timeout=6,
        )
        if r.ok:
            data = r.json()
            addr = data.get("address", {})
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county")
            country = addr.get("country")
            return data.get("display_name"), city, country
    except Exception as e:
        logging.warning(f"reverse_geocode failed: {e}")
    return None, None, None


def ip_geolocate(ip):
    try:
        r = requests.get(f"http://ip-api.com/json/{ip}", timeout=6)
        if r.ok:
            data = r.json()
            if data.get("status") == "success":
                place = ", ".join(filter(None, [data.get("city"), data.get("regionName"), data.get("country")]))
                return data.get("lat"), data.get("lon"), place, data.get("city"), data.get("country")
    except Exception as e:
        logging.warning(f"ip_geolocate failed: {e}")
    return None, None, None, None, None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "GeoReach Aid API"}


@api_router.post("/links")
async def create_link(payload: LinkCreate):
    url = payload.original_url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    # unique short code
    for _ in range(5):
        code = secrets.token_urlsafe(4)[:6]
        existing = await db.links.find_one({"short_code": code})
        if not existing:
            break

    link = TrackLink(short_code=code, original_url=url, title=payload.title)
    doc = link.model_dump(by_alias=True, exclude={"id"})
    res = await db.links.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.get("/links")
async def list_links():
    docs = await db.links.find().sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]


@api_router.get("/links/{short_code}")
async def get_link(short_code: str):
    link = await db.links.find_one({"short_code": short_code})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    records = await db.records.find({"short_code": short_code}).sort("timestamp", -1).to_list(1000)
    return {"link": serialize(link), "records": [serialize(r) for r in records]}


@api_router.get("/resolve/{short_code}")
async def resolve_link(short_code: str):
    link = await db.links.find_one({"short_code": short_code})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"original_url": link["original_url"], "title": link.get("title")}


@api_router.delete("/links/{short_code}")
async def delete_link(short_code: str):
    await db.links.delete_one({"short_code": short_code})
    await db.records.delete_many({"short_code": short_code})
    return {"ok": True}


@api_router.post("/track")
async def track(payload: TrackCreate, request: Request):
    link = await db.links.find_one({"short_code": payload.short_code})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    ip = get_client_ip(request)
    ua = request.headers.get("user-agent")
    device = parse_device(ua)

    lat, lng, accuracy = payload.lat, payload.lng, payload.accuracy
    method = payload.method
    place = city = country = None

    if lat is not None and lng is not None:
        place, city, country = await asyncio.to_thread(reverse_geocode, lat, lng)
        method = "gps"
    else:
        # IP fallback
        glat, glng, gplace, gcity, gcountry = await asyncio.to_thread(ip_geolocate, ip)
        lat, lng, place, city, country = glat, glng, gplace, gcity, gcountry
        method = "ip"

    record = LocationRecord(
        short_code=payload.short_code, lat=lat, lng=lng, accuracy=accuracy,
        method=method, place=place, city=city, country=country, ip=ip, user_agent=ua,
        **device,
    )
    doc = record.model_dump(by_alias=True, exclude={"id"})
    await db.records.insert_one(doc)
    await db.links.update_one({"short_code": payload.short_code}, {"$inc": {"click_count": 1}})

    return {"original_url": link["original_url"]}


@api_router.get("/records")
async def list_records():
    docs = await db.records.find().sort("timestamp", -1).to_list(5000)
    return [serialize(d) for d in docs]


@api_router.patch("/records/{record_id}")
async def update_record(record_id: str, payload: RecordUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.records.update_one({"_id": ObjectId(record_id)}, {"$set": update})
    doc = await db.records.find_one({"_id": ObjectId(record_id)})
    return serialize(doc)


@api_router.get("/export")
async def export_csv():
    docs = await db.records.find().sort("timestamp", -1).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["short_code", "lat", "lng", "accuracy", "method", "place", "city", "country", "ip", "device_type", "device_brand", "device_model", "os", "browser", "dispatch_status", "notes", "timestamp"])
    for d in docs:
        writer.writerow([
            d.get("short_code"), d.get("lat"), d.get("lng"), d.get("accuracy"), d.get("method"),
            d.get("place"), d.get("city"), d.get("country"), d.get("ip"),
            d.get("device_type"), d.get("device_brand"), d.get("device_model"), d.get("os"), d.get("browser"),
            d.get("dispatch_status"), d.get("notes"), d.get("timestamp"),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=location_records.csv"},
    )


# Simulator endpoint for demo/testing (fake a visitor click with location)
@api_router.post("/simulate")
async def simulate(payload: TrackCreate):
    link = await db.links.find_one({"short_code": payload.short_code})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    place, city, country = await asyncio.to_thread(reverse_geocode, payload.lat, payload.lng)
    sample_ua = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
    device = parse_device(sample_ua)
    record = LocationRecord(
        short_code=payload.short_code, lat=payload.lat, lng=payload.lng,
        accuracy=payload.accuracy or 20, method="gps",
        place=place, city=city, country=country, ip="simulated", user_agent=sample_ua,
        **device,
    )
    doc = record.model_dump(by_alias=True, exclude={"id"})
    await db.records.insert_one(doc)
    await db.links.update_one({"short_code": payload.short_code}, {"$inc": {"click_count": 1}})
    return serialize(doc)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
