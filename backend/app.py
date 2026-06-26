from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import SECRET_KEY

# -------------------------
# Flask App Factory
# -------------------------
def create_app():
    
    app = Flask(__name__)

    # Core Config
    app.secret_key = SECRET_KEY
    app.config["JWT_SECRET_KEY"] = SECRET_KEY
    from datetime import timedelta
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=5)
    
    # Initialize Limiter — shared instance lives in extensions.py so
    # controllers (like chatbot_controller.py) can import the SAME
    # limiter and decorate their own routes with @limiter.limit(...).
    from extensions import limiter
    limiter.init_app(app)


    # Enable CORS (React ↔ Flask)
    CORS(
        app,
        origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "https://health-track-mauve.vercel.app"
        ],
        supports_credentials=True,
        allow_headers="*",
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # JWT
    JWTManager(app)

    # -------------------------
    # Register Blueprints
    # -------------------------
    from controllers.auth_controller import auth_bp
    from controllers.patient_controller import patient_bp
    from controllers.watch_controller import watch_bp
    from controllers.api_controller import api_bp
    from controllers.chatbot_controller import chatbot_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(patient_bp)
    app.register_blueprint(watch_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(chatbot_bp)

    return app


# -------------------------
# Global App (IMPORTANT)
# -------------------------
app = create_app()


# -------------------------
# Run Server
# -------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
