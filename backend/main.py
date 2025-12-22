from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="EEG User API")

# CORS for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Test user data (matches your existing structure)
MOCK_USERS = {
    "user_001": {
        "id": "user_001",
        "profileComplete": True,
        "name": "Simran",
        "age": "23",
        "gender": "F",
        "personalityTest": {
            "completed": True,
            "timestamp": "2024-12-10T10:30:00",
            "scores": {
                "openness": 75,
                "conscientiousness": 82,
                "extraversion": 68,
                "agreeableness": 79,
                "neuroticism": 45
            }
        },
        "iafCalibration": {
            "completed": True,
            "timestamp": "2024-12-10T11:00:00",
            "iaf": 10.2
        }
    }
}

@app.get("/")
def health_check():
    """Check if backend is alive"""
    return {"status": "online", "message": "EEG User API"}

@app.get("/user/{user_id}")
def get_user(user_id: str):
    """Get user profile by ID"""
    if user_id not in MOCK_USERS:
        raise HTTPException(status_code=404, detail="User not found")
    
    return MOCK_USERS[user_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)