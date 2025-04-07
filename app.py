from flask import Flask, render_template

app = Flask(__name__)

#Главная страница
@app.route('/')
def home():
    return render_template('index.html')

#Route
@app.route('/route')
def test():
    return render_template('route.html')

#Debug
if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port='5000')
