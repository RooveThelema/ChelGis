from flask import Flask, render_template

app = Flask(__name__)

# --- ДАННЫЕ О МАРШРУТАХ ---
# Теперь храним их здесь для централизованного доступа
all_routes_data = {
    # Пешеходные
    'historical_pedestrian': {
        'id': 'historical_pedestrian',
        'name': "Исторический (пешком)",
        'type': 'pedestrian',
        'description': "Челябинск — город трудовой доблести. Посетите ключевые места, связанные с трудовым подвигом челябинцев в годы Великой Отечественной войны.",
        'full_description': "(данный маршрут рассчитан на пешее передвижение)",
        'points': [
             {'name': "Памятник Танкограду", 'coords': [55.164722, 61.400833], 'description': "Монумент в честь трудового подвига рабочих ЧТЗ."},
             {'name': "Музей трудовой славы", 'coords': [55.159722, 61.396667], 'description': "Экспозиция посвящена истории промышленности и вкладу города в победу."},
             {'name': "Площадь Революции", 'coords': [55.161111, 61.402778], 'description': "Центральная площадь города."}
        ]
    },
    'cultural_pedestrian': {
        'id': 'cultural_pedestrian',
        'name': "Культурно-развлекательный (пешком)",
        'type': 'pedestrian',
        'description': "Искусство и современность. Откройте для себя культурную жизнь Челябинска - театры, музеи и арт-пространства.",
         'full_description': "(данный маршрут рассчитан на пешее передвижение)",
        'points': [
             {'name': "Театр оперы и балета", 'coords': [55.166111, 61.401389], 'description': "Крупнейший театр города."},
             {'name': "Картинная галерея", 'coords': [55.163889, 61.398611], 'description': "Коллекция русского и западноевропейского искусства."},
             {'name': "Кинотеатр им. Пушкина", 'coords': [55.160833, 61.403889], 'description': "Один из старейших кинотеатров."}
        ]
    },
    'nature_pedestrian': {
        'id': 'nature_pedestrian',
        'name': "Природно-парковый (пешком)",
        'type': 'pedestrian',
        'description': "Зелёный Челябинск. Исследуйте самые красивые парки и природные уголки города.",
         'full_description': "(данный маршрут рассчитан на пешее передвижение)",
        'points': [
             {'name': "Парк Гагарина", 'coords': [55.156944, 61.393611], 'description': "Самый большой парк в Челябинске."},
             {'name': "Городской сад", 'coords': [55.162778, 61.405556], 'description': "Старейший парк в центре города."},
             {'name': "Набережная реки Миасс", 'coords': [55.158889, 61.408333], 'description': "Благоустроенная набережная для прогулок."}
        ]
    },
    # Автомобильные (пока те же точки, но другие описания)
    'historical_car': {
        'id': 'historical_car',
        'name': "Исторический (на машине)",
        'type': 'car',
        'description': "Обзорная поездка по местам трудовой доблести Челябинска времен ВОВ.",
        'full_description': "(данный маршрут рассчитан на перемещение в машине)",
        'points': [
             {'name': "Памятник Танкограду", 'coords': [55.164722, 61.400833], 'description': "Монумент в честь трудового подвига рабочих ЧТЗ."},
             {'name': "Музей трудовой славы", 'coords': [55.159722, 61.396667], 'description': "Экспозиция посвящена истории промышленности и вкладу города в победу."},
             {'name': "Площадь Революции", 'coords': [55.161111, 61.402778], 'description': "Центральная площадь города."}
        ] # Точки можно сделать другими для авто
    },
    'cultural_car': {
        'id': 'cultural_car',
        'name': "Культурный (на машине)",
        'type': 'car',
        'description': "Посетите основные культурные центры города на автомобиле.",
        'full_description': "(данный маршрут рассчитан на перемещение в машине)",
        'points': [
             {'name': "Театр оперы и балета", 'coords': [55.166111, 61.401389], 'description': "Крупнейший театр города."},
             {'name': "Картинная галерея", 'coords': [55.163889, 61.398611], 'description': "Коллекция русского и западноевропейского искусства."},
             {'name': "Кинотеатр им. Пушкина", 'coords': [55.160833, 61.403889], 'description': "Один из старейших кинотеатров."}
        ]
    },
     'nature_car': {
        'id': 'nature_car',
        'name': "Парки и набережная (на машине)",
        'type': 'car',
        'description': "Автомобильная прогулка с посещением парков и набережной.",
         'full_description': "(данный маршрут рассчитан на перемещение в машине)",
        'points': [
             {'name': "Парк Гагарина", 'coords': [55.156944, 61.393611], 'description': "Самый большой парк в Челябинске."},
             {'name': "Городской сад", 'coords': [55.162778, 61.405556], 'description': "Старейший парк в центре города."},
             {'name': "Набережная реки Миасс", 'coords': [55.158889, 61.408333], 'description': "Благоустроенная набережная."}
        ]
    },
}
# --------------------------

# Карта (Главная страница)
@app.route('/')
def home():
    # Передаем все маршруты в JS через data-* атрибут или отдельный JSON endpoint,
    # Но проще загрузить их прямо в script.js
    return render_template('index.html', active_page='home')

@app.route('/routes')
def show_routes():
    # Отбираем только пешеходные маршруты
    pedestrian_routes = {k: v for k, v in all_routes_data.items() if v['type'] == 'pedestrian'}
    return render_template('routes.html', active_page='routes', routes=pedestrian_routes)

# Поиск
@app.route('/search')
def search():
    # Передаем все маршруты для JS-фильтрации на клиенте
    return render_template('search.html', active_page='search', all_routes=all_routes_data)

# Маршруты на машине (переименовано)
@app.route('/on_car')
def on_car():
    # Отбираем только автомобильные маршруты
    car_routes = {k: v for k, v in all_routes_data.items() if v['type'] == 'car'}
    return render_template('on_car.html', active_page='on_car', routes=car_routes)

# Профиль
@app.route('/profile')
def profile():
    return render_template('profile.html', active_page='profile')

# Debug
if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)