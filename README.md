# news-nest
project code!

## Monorepo structure

```
news-nest/
  backend/
    app/
      config.py           # loads NEWSAPI_KEY from env/.env
      newsapi_client.py   # reusable client for NewsAPI
      main.py             # FastAPI server exposing /news
    cli.py                # generalized CLI wrapper
    requirements.txt      # backend deps
  examples/
    basic_news_call.py    # minimal example that prints recent articles
  README.md
  requirements.txt        # legacy root deps for simple script
```

## Environment

Create a `.env` file in the repo root (the backend reads from here too):

```
NEWSAPI_KEY=your_newsapi_key_here
```

## Backend API (FastAPI)

Install backend deps with the SAME interpreter you will use to run the server.

Option A — explicit Python 3.13 path:

```
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 -m pip install -r backend/requirements.txt
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 -m uvicorn app.main:app --reload --factory --app-dir backend
```

Option B — with alias:

```
python3.13 -m pip install -r backend/requirements.txt
python3.13 -m uvicorn app.main:app --reload --factory --app-dir backend
```

Option C — virtual environment:

```
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --reload --factory --app-dir backend
```

Option D - one line virtual environment:

```
backend/.venv/bin/python -m uvicorn app.main:app --reload --app-dir backend
```

API usage (examples):

```
GET http://localhost:8000/news?q=MIT&fromDays=7&language=en&sortBy=publishedAt&pageSize=25&page=1
GET http://localhost:8000/news?q=electric%20vehicles&fromDays=3&language=en
```

Notes:
- The server enables permissive CORS for development; lock down `allow_origins` for production in `backend/app/main.py`.
- Keep your NewsAPI key on the server; do not ship it to mobile clients.

## Generalized CLI usage (backend)

You can fetch arbitrary topics using the CLI (prints JSON to stdout):

```
python backend/cli.py --q "MIT" --from-days 7 --language en --page-size 25 --pretty
python backend/cli.py --q "electric vehicles" --from-days 3 --pretty
```

## Minimal example script

If you just want to see a simple call and console output (no server required):

```
python examples/basic_news_call.py --q "technology" --from-days 7 --page-size 10
```

## React Native (TypeScript) compatibility
RN app should call the backend API to avoid exposing the NewsAPI key in the app bundle. Example fetch in React Native:

```ts
const res = await fetch("http://localhost:8000/news?q=MIT&fromDays=7&language=en");
const data = await res.json();
```

For device testing, replace `localhost` with your machine IP or configure a reverse proxy/tunnel. You can also add a small TypeScript client wrapper later if desired.

