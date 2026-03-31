from __future__ import annotations

import os
import secrets
import string
from datetime import datetime, timezone

from chat_logic import TOPICS
from chat_service import run_chat
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
# Cloud Run: use /tmp for SQLite (ephemeral; use Cloud SQL for durable data).
_default_db = (
    "sqlite:////tmp/saathi.db"
    if os.environ.get("K_SERVICE")
    else "sqlite:///saathi.db"
)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", _default_db)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-change-in-production")

CORS(app, supports_credentials=True)
db = SQLAlchemy(app)

ADJ = [
    "Gentle", "Quiet", "Warm", "Calm", "Kind", "Soft", "Bright", "Peaceful",
    "Hopeful", "Brave", "Steady", "Tender",
]
NOUN = [
    "Lotus", "River", "Breeze", "Star", "Meadow", "Dove", "Sparrow", "Moon",
    "Garden", "Bloom", "Cloud", "Mango",
]


def generate_anonymous_handle() -> str:
    a = secrets.choice(ADJ)
    n = secrets.choice(NOUN)
    num = secrets.randbelow(900) + 100
    return f"{a}{n}{num}"


def generate_referral_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


class LHWUser(db.Model):
    __tablename__ = "lhw_users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)


class ReferralCode(db.Model):
    __tablename__ = "referral_codes"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    lhw_id = db.Column(db.Integer, db.ForeignKey("lhw_users.id"), nullable=False)
    used_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    anonymous_handle = db.Column(db.String(120), unique=True, nullable=False)
    referral_code_id = db.Column(db.Integer, db.ForeignKey("referral_codes.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class ForumPost(db.Model):
    __tablename__ = "forum_posts"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    topic = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(40), default="forum")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class ForumReply(db.Model):
    __tablename__ = "forum_replies"
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("forum_posts.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class ForumPostLike(db.Model):
    __tablename__ = "forum_post_likes"
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("forum_posts.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (db.UniqueConstraint("post_id", "user_id", name="uq_forum_post_like_user"),)


class ForumReplyLike(db.Model):
    __tablename__ = "forum_reply_likes"
    id = db.Column(db.Integer, primary_key=True)
    reply_id = db.Column(db.Integer, db.ForeignKey("forum_replies.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (db.UniqueConstraint("reply_id", "user_id", name="uq_forum_reply_like_user"),)


def _post_like_meta(post_id: int, viewer_id: int | None) -> tuple[int, bool]:
    q = ForumPostLike.query.filter_by(post_id=post_id)
    count = q.count()
    liked = (
        bool(viewer_id)
        and ForumPostLike.query.filter_by(post_id=post_id, user_id=viewer_id).first()
        is not None
    )
    return count, liked


def _reply_like_meta(reply_id: int, viewer_id: int | None) -> tuple[int, bool]:
    count = ForumReplyLike.query.filter_by(reply_id=reply_id).count()
    liked = (
        bool(viewer_id)
        and ForumReplyLike.query.filter_by(reply_id=reply_id, user_id=viewer_id).first()
        is not None
    )
    return count, liked


def user_public(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "anonymous_handle": u.anonymous_handle,
    }


@app.post("/api/auth/register")
def register():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    referral = (data.get("referral_code") or "").strip().upper()
    if not username or not password or not referral:
        return jsonify({"error": "username, password, and referral_code required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already taken"}), 409
    rc = ReferralCode.query.filter_by(code=referral).first()
    if not rc or rc.used_by_user_id is not None:
        return jsonify({"error": "invalid or already used referral code"}), 400
    handle = generate_anonymous_handle()
    while User.query.filter_by(anonymous_handle=handle).first():
        handle = generate_anonymous_handle()
    u = User(
        username=username,
        password_hash=generate_password_hash(password),
        anonymous_handle=handle,
        referral_code_id=rc.id,
    )
    db.session.add(u)
    db.session.flush()
    rc.used_by_user_id = u.id
    rc.used_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"user": user_public(u)}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    u = User.query.filter_by(username=username).first()
    if not u or not check_password_hash(u.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401
    return jsonify({"user": user_public(u)})


@app.post("/api/lhw/login")
def lhw_login():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    lhw = LHWUser.query.filter_by(username=username).first()
    if not lhw or not check_password_hash(lhw.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401
    return jsonify({"lhw": {"id": lhw.id, "username": lhw.username}})


@app.post("/api/lhw/referral-codes")
def create_referral():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "LHW username and password required"}), 400
    lhw = LHWUser.query.filter_by(username=username).first()
    if not lhw or not check_password_hash(lhw.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401
    code = generate_referral_code()
    while ReferralCode.query.filter_by(code=code).first():
        code = generate_referral_code()
    rc = ReferralCode(code=code, lhw_id=lhw.id)
    db.session.add(rc)
    db.session.commit()
    return jsonify({"code": code}), 201


@app.get("/api/forum/topics")
def forum_topics():
    return jsonify({"topics": list(TOPICS)})


@app.get("/api/forum/posts")
def list_posts():
    viewer_id = request.args.get("user_id", type=int)
    posts = ForumPost.query.order_by(ForumPost.created_at.desc()).limit(100).all()
    out = []
    for p in posts:
        u = db.session.get(User, p.user_id)
        like_count, liked = _post_like_meta(p.id, viewer_id)
        out.append(
            {
                "id": p.id,
                "topic": p.topic,
                "title": p.title,
                "body": p.body,
                "author_handle": u.anonymous_handle if u else "Anonymous",
                "created_at": p.created_at.isoformat(),
                "source": p.source,
                "like_count": like_count,
                "liked": liked,
            }
        )
    return jsonify({"posts": out})


@app.post("/api/forum/posts")
def create_post():
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get("user_id")
    topic = (data.get("topic") or "").strip()
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    source = (data.get("source") or "forum").strip()
    if not user_id or topic not in TOPICS or not title or not body:
        return jsonify({"error": "user_id, valid topic, title, body required"}), 400
    u = db.session.get(User, int(user_id))
    if not u:
        return jsonify({"error": "user not found"}), 404
    p = ForumPost(
        user_id=u.id, topic=topic, title=title, body=body, source=source
    )
    db.session.add(p)
    db.session.commit()
    return (
        jsonify(
            {
                "post": {
                    "id": p.id,
                    "topic": p.topic,
                    "title": p.title,
                    "body": p.body,
                    "author_handle": u.anonymous_handle,
                    "created_at": p.created_at.isoformat(),
                    "source": p.source,
                    "like_count": 0,
                    "liked": False,
                }
            }
        ),
        201,
    )


@app.get("/api/forum/posts/<int:post_id>/replies")
def list_replies(post_id: int):
    post = db.session.get(ForumPost, post_id)
    if not post:
        return jsonify({"error": "not found"}), 404
    viewer_id = request.args.get("user_id", type=int)
    rows = (
        ForumReply.query.filter_by(post_id=post_id)
        .order_by(ForumReply.created_at.asc())
        .all()
    )
    out = []
    for r in rows:
        u = db.session.get(User, r.user_id)
        like_count, liked = _reply_like_meta(r.id, viewer_id)
        out.append(
            {
                "id": r.id,
                "body": r.body,
                "author_handle": u.anonymous_handle if u else "Anonymous",
                "created_at": r.created_at.isoformat(),
                "like_count": like_count,
                "liked": liked,
            }
        )
    return jsonify({"replies": out})


@app.post("/api/forum/posts/<int:post_id>/replies")
def add_reply(post_id: int):
    data = request.get_json(force=True, silent=True) or {}
    post = db.session.get(ForumPost, post_id)
    if not post:
        return jsonify({"error": "not found"}), 404
    user_id = data.get("user_id")
    body = (data.get("body") or "").strip()
    if not user_id or not body:
        return jsonify({"error": "user_id and body required"}), 400
    u = db.session.get(User, int(user_id))
    if not u:
        return jsonify({"error": "user not found"}), 404
    r = ForumReply(post_id=post_id, user_id=u.id, body=body)
    db.session.add(r)
    db.session.commit()
    return (
        jsonify(
            {
                "reply": {
                    "id": r.id,
                    "body": r.body,
                    "author_handle": u.anonymous_handle,
                    "created_at": r.created_at.isoformat(),
                    "like_count": 0,
                    "liked": False,
                }
            }
        ),
        201,
    )


@app.post("/api/forum/posts/<int:post_id>/like")
def toggle_post_like(post_id: int):
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    post = db.session.get(ForumPost, post_id)
    if not post:
        return jsonify({"error": "not found"}), 404
    u = db.session.get(User, int(user_id))
    if not u:
        return jsonify({"error": "user not found"}), 404
    existing = ForumPostLike.query.filter_by(post_id=post_id, user_id=u.id).first()
    if existing:
        db.session.delete(existing)
        liked = False
    else:
        db.session.add(ForumPostLike(post_id=post_id, user_id=u.id))
        liked = True
    db.session.commit()
    count = ForumPostLike.query.filter_by(post_id=post_id).count()
    return jsonify({"liked": liked, "like_count": count})


@app.post("/api/forum/replies/<int:reply_id>/like")
def toggle_reply_like(reply_id: int):
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    reply = db.session.get(ForumReply, reply_id)
    if not reply:
        return jsonify({"error": "not found"}), 404
    u = db.session.get(User, int(user_id))
    if not u:
        return jsonify({"error": "user not found"}), 404
    existing = ForumReplyLike.query.filter_by(reply_id=reply_id, user_id=u.id).first()
    if existing:
        db.session.delete(existing)
        liked = False
    else:
        db.session.add(ForumReplyLike(reply_id=reply_id, user_id=u.id))
        liked = True
    db.session.commit()
    count = ForumReplyLike.query.filter_by(reply_id=reply_id).count()
    return jsonify({"liked": liked, "like_count": count})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/chat")
def chat():
    data = request.get_json(force=True, silent=True) or {}
    message = (data.get("message") or "").strip()
    topic = data.get("topic")
    if not message:
        return jsonify({"error": "message required"}), 400
    out = run_chat(message, topic)
    debug = request.args.get("debug") in {"1", "true", "yes", "on"}
    # Do not expose internal source to clients by default
    body = out if debug else {k: v for k, v in out.items() if k != "source"}
    return jsonify(body)


def _register_spa() -> None:
    dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "dist")
    index_html = os.path.join(dist, "index.html")
    if not os.path.isfile(index_html):
        return

    @app.get("/")
    @app.get("/<path:path>")
    def spa(path: str = ""):
        if path.startswith("api"):
            return jsonify({"error": "not found"}), 404
        if path:
            candidate = os.path.join(dist, path)
            if os.path.isfile(candidate):
                return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")


_register_spa()


def seed():
    db.create_all()
    if not LHWUser.query.filter_by(username="lhw_demo").first():
        lhw = LHWUser(
            username="lhw_demo",
            password_hash=generate_password_hash("lhw_demo_pass"),
        )
        db.session.add(lhw)
        db.session.commit()
        rc = ReferralCode(code="DEMO1234", lhw_id=lhw.id)
        db.session.add(rc)
        db.session.commit()
        print("Seeded LHW: lhw_demo / lhw_demo_pass, referral DEMO1234 (unused)")


with app.app_context():
    seed()


if __name__ == "__main__":
    # Default to 5050 locally to avoid macOS AirTunes/AirPlay conflicts on 5000.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5050)), debug=True)
