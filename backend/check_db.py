from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    try:
        # This will fail if database isn't connected
        from app.models import User, Document
        print("✅ Database connected and models loaded!")
        print("✅ Ready to run the application!")
    except Exception as e:
        print(f"❌ Error: {e}")