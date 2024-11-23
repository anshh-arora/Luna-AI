from flask import Flask, render_template, request, redirect, url_for, session
from flask_pymongo import PyMongo
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import os
import uuid

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

mongo = PyMongo(app)
bcrypt = Bcrypt(app)

# Initialize MongoDB collection
db = mongo.db.user_login  # Access the database
users_collection = db.login_details  # Access the collection


@app.route("/")
def home():
    if "user_id" in session:
        user = users_collection.find_one({"_id": session["user_id"]})
        return render_template("index.html", user=user)
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        user = users_collection.find_one({"email": email})

        if user and bcrypt.check_password_hash(user["password"], password):
            session["user_id"] = user["_id"]
            return redirect(url_for("home"))
        return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name")
        email = request.form.get("email")
        password = request.form.get("password")
        mobile = request.form.get("mobile")

        # Check if email already exists
        if users_collection.find_one({"email": email}):
            return render_template("register.html", error="Email already registered")

        # Hash password
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

        # Save user to the database
        new_user = {
            "_id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "password": hashed_password,
            "mobile": mobile,
        }
        users_collection.insert_one(new_user)
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/logout")
def logout():
    session.pop("user_id", None)
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(debug=True)
