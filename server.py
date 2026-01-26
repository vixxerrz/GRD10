# local_site.py
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 2767

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"""
        <html>
            <head><title>Local Site</title></head>
            <body>
                <h1>It works!</h1>
                <p>Your local website is running on port 67.</p>
            </body>
        </html>
        """)

if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), Handler)
    print(f"Serving on http://localhost:{PORT}")
    server.serve_forever()

