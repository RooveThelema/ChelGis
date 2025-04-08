// --- Глобальные переменные ---
let map;
let multiRoute;
let userLocation;
let currentPlacemarks = [];
let userPlacemark;
let currentTransportType = 'pedestrian';

// --- Константы и Загрузка данных ---
const chelyabinskCenter = [55.160026, 61.402554];
let allAvailableRoutes = {}; // Заполняется из JSON в HTML
const routesDataScript = document.getElementById('all-routes-data-script');
if (routesDataScript) {
    try {
        allAvailableRoutes = JSON.parse(routesDataScript.textContent);
        // console.log("Маршруты загружены:", allAvailableRoutes);
    } catch (e) {
        console.error("Ошибка парсинга данных маршрутов:", e);
    }
} else {
     // Если мы не на странице поиска, этого скрипта не будет - это нормально.
     // console.warn("Не найден скрипт с данными маршрутов (id='all-routes-data-script').");
}
const allRouteIds = Object.keys(allAvailableRoutes);

// Состояние фильтров в поиске (по умолчанию все включены)
let searchRouteFilters = {
    pedestrian: true,
    car: true
};

// --- Функции карты и маршрутизации ---

function initMap() {
    console.log("initMap: Начало инициализации карты..."); // Лог 1
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("initMap: Элемент #map не найден!"); // Лог 2
        return;
    }
    if (typeof ymaps === 'undefined' || !ymaps.ready) { // Проверяем и ymaps и метод ready
         console.error("initMap: API Яндекс Карт (ymaps) не загружено или не готово!"); // Лог 3
         mapElement.innerHTML = '<p style="padding:20px; text-align:center; color: var(--text-secondary-on-light);">Не удалось загрузить API Карт. Проверьте интернет-соединение и обновите страницу.</p>';
         return;
    }

    ymaps.ready().then(function() { // Используем .then() для асинхронности
        console.log("initMap: ymaps.ready сработал."); // Лог 4
        try {
            // Создаем карту, передавая сам DOM-элемент
            map = new ymaps.Map(mapElement, {
                 center: chelyabinskCenter,
                 zoom: 13,
                 controls: ['zoomControl']
             });
            console.log("initMap: Объект карты создан.", map); // Лог 5

            // Инициализируем систему маршрутов
            initMultiRoute();
            console.log("initMap: MultiRoute инициализирован."); // Лог 6

            // Настраиваем обработчики для карты (клик по меткам, кнопкам и т.д.)
            setupMapInteractionHandlers();
            console.log("initMap: Обработчики карты настроены."); // Лог 7

            // Получаем геолокацию ПОСЛЕ создания карты
            getUserLocation();
            console.log("initMap: Запрос геолокации отправлен."); // Лог 8

            // Проверяем localStorage ПОСЛЕ создания карты
            checkLocalStorageForActions();
            console.log("initMap: Проверка localStorage завершена."); // Лог 9

        } catch (e) {
             console.error("initMap: Ошибка при создании или настройке карты:", e); // Лог Ошибки
             mapElement.innerHTML = '<p style="padding:20px; text-align:center; color: var(--text-secondary-on-light);">Ошибка при инициализации карты.</p>';
        }

    }).catch(function(error) {
         console.error("initMap: Ошибка в ymaps.ready:", error); // Лог Ошибки API
          mapElement.innerHTML = '<p style="padding:20px; text-align:center; color: var(--text-secondary-on-light);">Ошибка при загрузке модулей карт.</p>';
    });
}

function checkLocalStorageForActions(){
     console.log("checkLocalStorageForActions: Проверка..."); // Лог 10
     if (!map || !ymaps) {
          console.warn("checkLocalStorageForActions: Карта или API не готовы."); // Лог 11
          return; // Не выполняем действий, если карта не готова
     }

     const routeIdToBuild = localStorage.getItem('buildRouteOnLoad');
     const resultToShow = localStorage.getItem('showResultOnLoad');

     if (routeIdToBuild && allAvailableRoutes[routeIdToBuild]) {
         console.log("checkLocalStorageForActions: Найден маршрут для построения:", routeIdToBuild); // Лог 12
         localStorage.removeItem('buildRouteOnLoad');
         // API уже готово, ymaps.ready не нужен
         buildRoute(allAvailableRoutes[routeIdToBuild]);
     } else if (resultToShow) {
         console.log("checkLocalStorageForActions: Найдена точка для отображения."); // Лог 13
         localStorage.removeItem('showResultOnLoad');
         try {
             const resultData = JSON.parse(resultToShow);
             // API уже готово
             showSearchResultOnMap(resultData);
         } catch (e) {
             console.error("checkLocalStorageForActions: Ошибка парсинга точки из localStorage", e); // Лог Ошибки
         }
     } else {
          console.log("checkLocalStorageForActions: Нет действий в localStorage."); // Лог 14
          // Если нет действий, можно просто центрировать по геолокации, если она есть
          // if (userLocation && map) {
          //    map.setCenter(userLocation, 14);
          // }
     }
}

function getUserLocation() {
    if (!ymaps || !ymaps.geolocation) {
         console.warn("getUserLocation: ymaps или ymaps.geolocation не доступен.");
         return;
    };
    ymaps.geolocation.get({
        provider: 'yandex', // или 'browser'
        mapStateAutoApply: false // Не двигаем карту автоматически
    }).then(function(result) {
        userLocation = result.geoObjects.get(0).geometry.getCoordinates();
        console.log("getUserLocation: Позиция получена:", userLocation); // Лог
        addUserPlacemark(); // Добавляем/обновляем метку

        // Обновляем маршрут, если он уже построен
        if (multiRoute && multiRoute.model.getReferencePoints().length > 1) {
            console.log("getUserLocation: Обновляем существующий маршрут."); // Лог
            updateRouteWithUserLocation();
        }
        // Центрирование происходит в checkLocalStorageForActions или при инициализации,
        // чтобы избежать перепрыгивания, если строится маршрут.

    }, function(err) {
        console.warn('getUserLocation: Не удалось определить местоположение', err); // Лог-предупреждение
        userLocation = null;
    });
}

function addUserPlacemark() {
    if (!map) return; // Карта должна быть готова
    if (userLocation) {
        if (userPlacemark && userPlacemark.geometry) { // Проверяем, есть ли старая метка
             // Обновляем позицию существующей метки вместо удаления/добавления
             userPlacemark.geometry.setCoordinates(userLocation);
             console.log("addUserPlacemark: Метка пользователя обновлена."); // Лог
        } else {
             // Удаляем старую на всякий случай (если была без geometry?)
            if (userPlacemark) map.geoObjects.remove(userPlacemark);
            // Создаем новую
            userPlacemark = new ymaps.Placemark(userLocation, {
                // hintContent: 'Вы здесь', // Убрал, может мешать
                balloonContentHeader: 'Вы здесь',
            }, {
                preset: 'islands#geolocationIcon', // Стандартная иконка геолокации
                zIndex: 500 // Поверх маршрутов и точек
            });
            map.geoObjects.add(userPlacemark);
            console.log("addUserPlacemark: Метка пользователя добавлена."); // Лог
        }
    } else {
         // Если userLocation null (не удалось определить), удаляем метку
         if (userPlacemark) {
              map.geoObjects.remove(userPlacemark);
              userPlacemark = null;
              console.log("addUserPlacemark: Метка пользователя удалена (геолокация не удалась)."); // Лог
         }
    }
}

function initMultiRoute() {
    if (!map || !ymaps || !ymaps.multiRouter) {
         console.warn("initMultiRoute: Карта или ymaps.multiRouter не готовы.");
         return;
    }
    // Удаляем старый маршрут, если он был
    if (multiRoute) {
        map.geoObjects.remove(multiRoute);
        multiRoute = null; // Сбрасываем ссылку
    }
    // Создаем новый
    multiRoute = new ymaps.multiRouter.MultiRoute({
        referencePoints: [], // Изначально пустой
        params: { routingMode: currentTransportType }
    }, {
        boundsAutoApply: true, // Автомасштабирование
        // Стили точек и линий (как в предыдущей версии)
         wayPointStartIconLayout: "default#image",
         wayPointStartIconImageHref: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="27" height="41"><path fill="var(--accent-green)" d="M13.5 0C6.058 0 0 6.058 0 13.5 0 24.213 13.5 41 13.5 41s13.5-16.787 13.5-27.5C27 6.058 20.942 0 13.5 0zm0 19.125a5.625 5.625 0 1 1 0-11.25 5.625 5.625 0 0 1 0 11.25z"/><circle fill="%23fff" cx="13.5" cy="13.5" r="4.5"/></svg>'.replace('var(--accent-green)', getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim() || '#34C759'), // Используем CSS переменную для цвета
         wayPointStartIconImageSize: [27, 41],
         wayPointStartIconImageOffset: [-13.5, -41],

         viaPointIconLayout: "default#image",
         viaPointIconImageHref: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="27" height="41"><path fill="%23007AFF" d="M13.5 0C6.058 0 0 6.058 0 13.5 0 24.213 13.5 41 13.5 41s13.5-16.787 13.5-27.5C27 6.058 20.942 0 13.5 0zm0 19.125a5.625 5.625 0 1 1 0-11.25 5.625 5.625 0 0 1 0 11.25z"/><circle fill="%23fff" cx="13.5" cy="13.5" r="4.5"/></svg>', // Синий для промежуточных
         viaPointIconImageSize: [27, 41],
         viaPointIconImageOffset: [-13.5, -41],

         routeActiveStrokeWidth: 5,
         routeActiveStrokeStyle: 'solid',
         routeActiveStrokeColor: getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim() || '#34C759', // Цвет активного маршрута из CSS

         routeStrokeStyle: 'dot',
         routeStrokeColor: '#007AFF' // Цвет неактивного маршрута
    });

    // События маршрута
    multiRoute.model.events.add('requestsuccess', updateRouteInfo);
    multiRoute.model.events.add('requestfail', function (event) {
        console.error("Ошибка построения маршрута:", event.get('error'));
        const routeDetails = document.getElementById('route-details');
        if(routeDetails) routeDetails.innerHTML = '<p>Не удалось построить маршрут.</p>';
        const routeInstructions = document.getElementById('route-instructions');
        if(routeInstructions) routeInstructions.innerHTML = '';
    });

    // Добавляем маршрут на карту
    map.geoObjects.add(multiRoute);
}

function clearMap() {
    if (!map) return;
    console.log("clearMap: Очистка карты..."); // Лог
    // Удаляем метки маршрутов/поиска (кроме метки пользователя)
    currentPlacemarks.forEach(pm => map.geoObjects.remove(pm));
    currentPlacemarks = [];

    // Удаляем старый объект маршрута с карты
    if (multiRoute) {
        map.geoObjects.remove(multiRoute);
        multiRoute = null; // Важно сбросить ссылку
    }

    // Скрываем панели информации
    const routeInfoPanel = document.getElementById('route-info');
    if(routeInfoPanel) routeInfoPanel.style.display = 'none';
    const pointDetailsPanel = document.getElementById('point-details');
    if(pointDetailsPanel) pointDetailsPanel.style.display = 'none';

    // Очищаем содержимое панелей
    const routeDetails = document.getElementById('route-details');
    if(routeDetails) routeDetails.innerHTML = '';
    const routeInstructions = document.getElementById('route-instructions');
    if(routeInstructions) routeInstructions.innerHTML = '';

    // Инициализируем новый ПУСТОЙ объект маршрутизации
    // initMultiRoute(); // Не нужно здесь, т.к. он будет вызван при следующем buildRoute или показе точки
    console.log("clearMap: Очистка завершена."); // Лог
}

function buildRoute(routeData) {
    if (!map || !ymaps) { console.warn("buildRoute: Карта или API не готовы."); return; }
    if (!routeData || !routeData.points || !routeData.points.length === 0) { console.warn("buildRoute: Нет данных маршрута или точек."); return; }
    console.log("buildRoute: Строим маршрут:", routeData.id); // Лог

    clearMap(); // Очищаем предыдущий маршрут и метки (кроме пользователя)
    // Метка пользователя остается или обновится в addUserPlacemark

    const points = routeData.points;

    // Добавляем метки точек маршрута
    points.forEach((point, index) => {
        const placemark = new ymaps.Placemark(point.coords, {
            hintContent: point.name || routeData.name,
            balloonContentHeader: point.name || ('Точка ' + (index + 1)),
            balloonContentBody: point.description || ''
        }, {
             // preset: 'islands#blueIcon', // Стандартная синяя
             // Используем кастомную синюю иконку для точек маршрута
             iconLayout: 'default#image',
             iconImageHref: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="27" height="41"><path fill="%23007AFF" d="M13.5 0C6.058 0 0 6.058 0 13.5 0 24.213 13.5 41 13.5 41s13.5-16.787 13.5-27.5C27 6.058 20.942 0 13.5 0zm0 19.125a5.625 5.625 0 1 1 0-11.25 5.625 5.625 0 0 1 0 11.25z"/><circle fill="%23fff" cx="13.5" cy="13.5" r="4.5"/></svg>',
             iconImageSize: [27, 41],
             iconImageOffset: [-13.5, -41],
             zIndex: 400 // Ниже метки пользователя
        });
        placemark.events.add('click', function() {
            showPointDetails({
                 name: point.name || ('Точка ' + (index + 1)),
                 coords: point.coords,
                 description: point.description || ''
            });
        });
        map.geoObjects.add(placemark);
        currentPlacemarks.push(placemark); // Добавляем в список для будущей очистки
    });
    console.log("buildRoute: Метки точек добавлены:", points.length); // Лог

    const referencePoints = [];
    // Добавляем точку пользователя, если она есть
    if (userLocation) {
        referencePoints.push([...userLocation]); // Используем копию координат
        console.log("buildRoute: Добавлена точка пользователя."); // Лог
    } else {
         console.log("buildRoute: Точка пользователя не добавлена (нет геолокации)."); // Лог
    }
    // Добавляем точки маршрута
    referencePoints.push(...points.map(p => ({ point: p.coords })));
    console.log("buildRoute: Опорные точки для multirouter:", referencePoints.length); // Лог

    // Инициализируем multiRoute, если его нет (после clearMap)
    if (!multiRoute) {
        initMultiRoute();
        if (!multiRoute) { // Если и после этого нет - что-то не так с API
             console.error("buildRoute: Не удалось инициализировать multiRoute!");
             return;
        }
    }

    // Устанавливаем ТИП транспорта для построения (важно!)
    currentTransportType = routeData.type === 'car' ? 'auto' : 'pedestrian';
    console.log("buildRoute: Тип транспорта установлен:", currentTransportType); // Лог
    // Обновляем кнопки выбора транспорта на панели
    document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.transport-btn[data-type="${currentTransportType}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Устанавливаем точки и параметры в модель маршрута
    multiRoute.model.setReferencePoints(referencePoints);
    multiRoute.model.setParams({ routingMode: currentTransportType }, true); // true - перестроить маршрут

    // Показываем панель информации
    const routeInfoPanel = document.getElementById('route-info');
    if(routeInfoPanel) routeInfoPanel.style.display = 'block';
    const pointDetailsPanel = document.getElementById('point-details');
    if(pointDetailsPanel) pointDetailsPanel.style.display = 'none'; // Скрываем детали точки

    // Показываем статус загрузки в панелях
    const routeDetails = document.getElementById('route-details');
    if(routeDetails) routeDetails.innerHTML = '<div class="loading">Построение маршрута...</div>';
    const routeInstructions = document.getElementById('route-instructions');
    if(routeInstructions) routeInstructions.innerHTML = ''; // Очищаем старые инструкции

    // Масштабирование карты под маршрут произойдет автоматически (boundsAutoApply: true)
    // Метку пользователя можно обновить/добавить еще раз на всякий случай
    addUserPlacemark();
}


function updateRouteInfo() {
    if (!multiRoute) return;
    const activeRoute = multiRoute.getActiveRoute();
    const routeDetails = document.getElementById('route-details');
    console.log("updateRouteInfo: Маршрут обновлен/построен."); // Лог

    if (!activeRoute) {
        console.warn("updateRouteInfo: Активный маршрут не найден после запроса."); // Лог
        if(routeDetails) routeDetails.innerHTML = '<p style="color:red;">Маршрут не построен.</p>'; // Выделим ошибку
        const routeInstructions = document.getElementById('route-instructions');
        if(routeInstructions) routeInstructions.innerHTML = '';
        return;
    }

    const properties = activeRoute.properties.getAll();
    // Проверка наличия distance и duration
    const distanceText = properties.distance ? properties.distance.text : 'неизвестно';
    const durationText = properties.duration ? properties.duration.text : 'неизвестно';

    console.log(`updateRouteInfo: Длина: ${distanceText}, Время: ${durationText}`); // Лог

    let html = `<p><strong>Длина:</strong> ${distanceText}</p>`;
    html += `<p><strong>Время:</strong> ${durationText}</p>`;
    if(routeDetails) routeDetails.innerHTML = html;

    // Получаем и отображаем инструкции
    getRouteInstructions(activeRoute);

    // Убеждаемся, что нужная панель видима
    const routeInfoPanel = document.getElementById('route-info');
    if(routeInfoPanel) routeInfoPanel.style.display = 'block';
    const pointDetailsPanel = document.getElementById('point-details');
    if(pointDetailsPanel) pointDetailsPanel.style.display = 'none';
}

function getRouteInstructions(route) {
    const cont = document.getElementById('route-instructions');
    if (!cont) return;
    cont.innerHTML = '<h4>Как добраться:</h4>'; // Заголовок

    try {
         const paths = route.getPaths();
         if (!paths || paths.getLength() === 0) throw new Error("Нет путей (paths)");

         let hasInstructions = false; // Флаг, что хоть одна инструкция добавлена

         paths.each(function (path) {
             const segments = path.getSegments();
             if (!segments || segments.getLength() === 0) return; // Пропускаем пустые сегменты пути

             segments.each(function (segment) {
                 const props = segment.properties;
                 const step = document.createElement('div');
                 step.className = 'instruction-step';
                 let text = '';

                 // Получаем данные сегмента
                 const action = props.get('action'); // "Поверните налево", "Продолжайте движение"
                 const street = props.get('street'); // Название улицы
                 const distance = props.get('distance')?.text; // "500 м"
                 const duration = props.get('duration')?.text; // "5 мин"
                 const transport = props.get('transport'); // Информация об общественном транспорте
                 const exitNumber = props.get('exitNumber'); // Номер съезда (для авто)

                 // Формируем текст инструкции
                 if (action) { text += action; }
                 if (street) { text += ` на ${street}`; }
                 else if (transport) {
                     const type = transport.type; const name = transport.name; let transportName = '';
                     if (type === 'bus') transportName = 'Автобус'; else if (type === 'tramway') transportName = 'Трамвай';
                     else if (type === 'trolleybus') transportName = 'Троллейбус'; else transportName = 'Транспорт';
                     text = `На ${transportName} ${name || ''}`;
                     const startStop = props.get('startPointName'); const endStop = props.get('endPointName'); const stops = props.get('stopsCount');
                     if(startStop) text += ` от "${startStop}"`; if(endStop) text += ` до "${endStop}"`; if(stops) text += ` (${stops} ост.)`;
                 } else if (exitNumber) { // Добавляем номер съезда, если есть
                      text += `, съезд ${exitNumber}`;
                 } else if (!action && !street && !transport) {
                      text = "Двигайтесь"; // Общая фраза, если ничего нет
                 }

                 // Пропускаем базовые "продолжайте движение" без доп. информации
                 if (action === 'Продолжайте движение' && !street && !distance && !duration && !exitNumber) {
                      return;
                 }

                 // Добавляем расстояние и время
                 if (distance || duration) {
                      text += ` (${distance || ''}${distance && duration ? ', ' : ''}${duration || ''})`;
                 }

                 step.innerHTML = text.trim();
                 if (step.innerHTML) { // Добавляем только непустые шаги
                     cont.appendChild(step);
                     hasInstructions = true;
                 }
             });
         });

         if (!hasInstructions) { // Если не добавили ни одной инструкции
             cont.innerHTML += '<p>Инструкции недоступны.</p>';
         }

    } catch (e) {
         console.error("Ошибка получения инструкций:", e);
         cont.innerHTML += '<p style="color:red;">Не удалось загрузить инструкции.</p>'; // Выделим ошибку
    }
}


function showPointDetails(point) {
    const pT = document.getElementById('point-title'); const pDesc = document.getElementById('point-description');
    const nB = document.getElementById('navigate-to-point'); const rIP = document.getElementById('route-info');
    const pDP = document.getElementById('point-details');

    if (!pT || !pDesc || !nB || !pDP) { console.warn("showPointDetails: Не найдены элементы панели деталей."); return; }

    if (!point || !point.name || !point.coords ) { console.warn("showPointDetails: Нет данных точки:", point); return; }

    console.log("showPointDetails: Показ деталей для:", point.name); // Лог

    pT.textContent = point.name;
    pDesc.innerHTML = point.description || ""; // Описание точки
    nB.dataset.coords = point.coords.join(',');
    nB.dataset.name = point.name;

    if(rIP) rIP.style.display = 'none'; // Скрываем инфо о маршруте
    pDP.style.display = 'block'; // Показываем детали
}

// --- Функции Поиска и Фильтрации ---

function displaySuggestions(query = '') {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return; // Мы не на странице поиска
    resultsContainer.innerHTML = ''; // Очищаем перед показом

    const lowerCaseQuery = query.trim().toLowerCase();

    // Фильтруем маршруты по типу (чекбоксы) и тексту (query)
    const filteredRouteIds = allRouteIds.filter(id => {
        const route = allAvailableRoutes[id];
        if (!route) return false; // На случай ошибок в данных
        // 1. Фильтр по типу
        if (!searchRouteFilters[route.type]) return false;
        // 2. Фильтр по тексту (если текст введен)
        if (lowerCaseQuery && !route.name.toLowerCase().includes(lowerCaseQuery)) return false;
        return true; // Маршрут подходит
    });

    console.log(`displaySuggestions: Найдено ${filteredRouteIds.length} маршрутов по запросу "${query}" и фильтрам`, searchRouteFilters); // Лог

    // Отображаем отфильтрованные маршруты
    if (filteredRouteIds.length > 0) {
        filteredRouteIds.forEach(routeId => {
            const routeData = allAvailableRoutes[routeId];
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <strong>${routeData.name}</strong>
                <small>${routeData.type === 'pedestrian' ? 'Пеший маршрут' : 'Автомобильный маршрут'}</small>
            `;
            item.addEventListener('click', function() {
                console.log("Выбран маршрут из подсказок:", routeId); // Лог
                localStorage.setItem('buildRouteOnLoad', routeId);
                window.location.href = '/'; // Переход на главную для построения
            });
            resultsContainer.appendChild(item);
        });
    } else if (!lowerCaseQuery) {
        // Если поле пустое и ничего не найдено (из-за фильтров)
        resultsContainer.innerHTML = '<p style="padding: 15px; color: var(--text-secondary-on-light);">Нет маршрутов, соответствующих фильтру.</p>';
    }
    // Если был введен текст и маршруты не найдены, пока ничего не пишем - ждем результатов геокодера

}

function searchPlace(query) {
    const trimmedQuery = query.trim();
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return; // Не страница поиска

    console.log(`searchPlace: Поиск по запросу: "${trimmedQuery}"`); // Лог

    if (!trimmedQuery) {
        displaySuggestions(); // Показываем маршруты по фильтрам
        return;
    }

    const lowerCaseQuery = trimmedQuery.toLowerCase();
    let matchedRouteId = null;

    // Ищем ТОЧНОЕ совпадение имени маршрута с учетом фильтров
    for (const id of allRouteIds) {
         const route = allAvailableRoutes[id];
        if (searchRouteFilters[route.type] && route.name.toLowerCase() === lowerCaseQuery) {
            matchedRouteId = id;
            break;
        }
    }

    if (matchedRouteId) {
        console.log("searchPlace: Найдено точное совпадение маршрута:", matchedRouteId); // Лог
        localStorage.setItem('buildRouteOnLoad', matchedRouteId);
        window.location.href = '/'; // Переходим строить
        return;
    }

    // Точного совпадения нет. Сначала показываем подходящие маршруты (частичное совпадение + фильтр).
    displaySuggestions(trimmedQuery);

    // Добавляем индикатор загрузки для геокодера
    // Удаляем старый индикатор, если он есть
    const oldLoading = document.getElementById('geocode-loading');
    if (oldLoading) oldLoading.remove();
    // Добавляем новый
    resultsContainer.insertAdjacentHTML('beforeend', '<div class="loading" id="geocode-loading" style="margin-top:15px;">Поиск мест...</div>');

    if (!ymaps || !ymaps.geocode) {
         console.error("searchPlace: ymaps.geocode недоступен!"); // Лог Ошибки
         const loading = document.getElementById('geocode-loading');
         if(loading) loading.textContent = 'Ошибка: API геокодирования недоступно.';
         return;
    }

    // Выполняем геокодирование с небольшой задержкой
    setTimeout(() => {
         console.log("searchPlace: Вызов geocodeQuery..."); // Лог
         geocodeQuery(trimmedQuery, resultsContainer);
    }, 300); // Небольшая задержка
}

function geocodeQuery(query, resultsContainer, bounds = null) {
     const loadingIndicator = document.getElementById('geocode-loading');

     ymaps.geocode(query, {
             results: 5, // Ограничим количество мест
             boundedBy: bounds, // Искать предпочтительно в видимой области (если передано)
             strictBounds: false // Но не только в ней
         }).then(function(res) {
             if(loadingIndicator) loadingIndicator.remove(); // Убираем индикатор

             const geoObjects = res.geoObjects;
             console.log(`geocodeQuery: Геокодер вернул ${geoObjects.getLength()} мест.`); // Лог

             const hasRoutesDisplayed = resultsContainer.querySelector('.search-result-item strong') !== null;

             if (geoObjects.getLength() === 0 && !hasRoutesDisplayed) {
                  // Если и маршрутов не было, и мест не найдено
                 resultsContainer.innerHTML = '<p style="padding: 15px; color: var(--text-secondary-on-light);">Ничего не найдено.</p>';
                 return;
             }

             // Добавляем разделитель, только если были показаны маршруты И найдены места
             if (hasRoutesDisplayed && geoObjects.getLength() > 0) {
                  const separator = document.createElement('hr');
                  // Стили из CSS для --separator-light
                  separator.style.cssText = 'margin: 15px 0 5px 0; border: none; border-top: 1px solid var(--separator-light);';
                  resultsContainer.appendChild(separator);
             }

             // Добавляем найденные места в список
             geoObjects.each(function(obj) {
                 const coords = obj.geometry.getCoordinates();
                 const address = obj.getAddressLine();
                 const name = obj.properties.get('name') || address;
                 const resultData = { name, address, description: address, coords };

                 const item = document.createElement('div');
                 item.className = 'search-result-item'; // Используем тот же класс
                 item.innerHTML = `<strong>${name}</strong><br><small>${address}</small>`;
                 item.addEventListener('click', function() {
                      console.log("Выбрано место из геокодера:", name); // Лог
                     localStorage.setItem('showResultOnLoad', JSON.stringify(resultData));
                     window.location.href = '/'; // Переход на главную для показа
                 });
                 resultsContainer.appendChild(item);
             });

         }, function(err) {
             console.error('geocodeQuery: Ошибка геокодирования:', err); // Лог Ошибки
             if(loadingIndicator) loadingIndicator.textContent = 'Ошибка поиска мест.';
             // Не очищаем результаты, если были показаны маршруты
             if (resultsContainer.children.length === 0) { // Очищаем только если вообще ничего нет
                 resultsContainer.innerHTML = '<p style="padding: 15px; color: red;">Ошибка при поиске мест.</p>';
             }
         });
}


function showSearchResultOnMap(result) {
    if (!map || !ymaps) { console.warn("showSearchResultOnMap: Карта или API не готовы."); return; }
    if (!result || !result.coords) { console.warn("showSearchResultOnMap: Нет данных точки."); return; }

    console.log("showSearchResultOnMap: Показ точки:", result.name); // Лог
    clearMap(); // Очищаем карту

    map.setCenter(result.coords, 15); // Центрируем

    // Добавляем метку найденного места
    const placemark = new ymaps.Placemark(result.coords, {
        hintContent: result.name,
        balloonContentHeader: result.name,
        balloonContentBody: result.address
    }, {
        // preset: 'islands#blueDotIcon' // Точка
        // Используем кастомную синюю иконку, как для точек маршрута
         iconLayout: 'default#image',
         iconImageHref: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="27" height="41"><path fill="%23007AFF" d="M13.5 0C6.058 0 0 6.058 0 13.5 0 24.213 13.5 41 13.5 41s13.5-16.787 13.5-27.5C27 6.058 20.942 0 13.5 0zm0 19.125a5.625 5.625 0 1 1 0-11.25 5.625 5.625 0 0 1 0 11.25z"/><circle fill="%23fff" cx="13.5" cy="13.5" r="4.5"/></svg>',
         iconImageSize: [27, 41],
         iconImageOffset: [-13.5, -41],
         zIndex: 400
    });

    // По клику на метку открываем панель деталей
    placemark.events.add('click', function() {
        showPointDetails({
            name: result.name,
            coords: result.coords,
            description: result.address // В качестве описания используем адрес
        });
    });

    map.geoObjects.add(placemark);
    currentPlacemarks.push(placemark); // Добавляем для будущей очистки

    addUserPlacemark(); // Добавляем метку пользователя поверх

    // Сразу показываем панель деталей для найденной точки
    showPointDetails({
        name: result.name,
        coords: result.coords,
        description: result.address
    });
}

function updateRouteTransportType(newType) {
    if (!multiRoute) return; // Маршрут должен быть
    if (currentTransportType === newType) return; // Тип не изменился

    console.log("updateRouteTransportType: Смена типа на:", newType); // Лог
    currentTransportType = newType;

    // Обновляем активную кнопку
    document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.transport-btn[data-type="${newType}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Если маршрут УЖЕ построен (есть точки), перестраиваем его
    if (multiRoute.model.getReferencePoints().length > 0) {
         console.log("updateRouteTransportType: Перестроение существующего маршрута..."); // Лог
         const routeDetails = document.getElementById('route-details');
         if(routeDetails) routeDetails.innerHTML = '<div class="loading">Перестроение...</div>';
         const routeInstructions = document.getElementById('route-instructions');
         if(routeInstructions) routeInstructions.innerHTML = '';
         // Устанавливаем новый тип и перестраиваем
        multiRoute.model.setParams({ routingMode: currentTransportType }, true);
    } else {
         // Если маршрут еще не построен, просто обновляем параметр для будущих построений
        multiRoute.model.setParams({ routingMode: currentTransportType });
    }
}

function updateRouteWithUserLocation() {
     if (!multiRoute || !userLocation) return; // Нужен маршрут и позиция

     const currentPoints = multiRoute.model.getReferencePoints();
     if (currentPoints.length === 0) return; // Маршрут пуст, нечего обновлять

     console.log("updateRouteWithUserLocation: Обновление начальной точки маршрута."); // Лог

     let userPointIndex = -1;
     // Ищем, есть ли уже точка пользователя и на каком она месте
     currentPoints.forEach((p, index) => {
         // Точка может быть массивом [lat, lon] или объектом { point: [lat, lon] }
         const pCoords = Array.isArray(p) ? p : (p && p.point ? p.point : null);
         if(pCoords && pCoords[0] === userLocation[0] && pCoords[1] === userLocation[1]) {
              userPointIndex = index;
         }
     });

     const newUserLocationPoint = [...userLocation]; // Свежие координаты

     if (userPointIndex === 0) {
         // Если пользователь уже был первой точкой, просто обновляем ее координаты
         currentPoints[0] = newUserLocationPoint;
         console.log("updateRouteWithUserLocation: Координаты первой точки обновлены."); // Лог
     } else {
         // Если точка пользователя была не первой или отсутствовала
         if (userPointIndex > 0) {
             currentPoints.splice(userPointIndex, 1); // Удаляем ее со старого места
             console.log("updateRouteWithUserLocation: Старая точка пользователя удалена."); // Лог
         }
         currentPoints.unshift(newUserLocationPoint); // Добавляем/переносим в начало
         console.log("updateRouteWithUserLocation: Точка пользователя добавлена в начало."); // Лог
     }

     // Убедимся, что точки передаются в правильном формате (только массивы координат для setReferencePoints)
     const formattedPoints = currentPoints.map(p => Array.isArray(p) ? p : (p && p.point ? p.point : null)).filter(p => p !== null);

     // Обновляем точки в модели и перестраиваем маршрут
     multiRoute.model.setReferencePoints(formattedPoints);

     const routeDetails = document.getElementById('route-details');
     if(routeDetails) routeDetails.innerHTML = '<div class="loading">Обновление маршрута...</div>';
     const routeInstructions = document.getElementById('route-instructions');
     if(routeInstructions) routeInstructions.innerHTML = '';

     multiRoute.model.setParams({ routingMode: currentTransportType }, true); // Перестроить
}


// --- Инициализация и общие обработчики ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded: DOM загружен."); // Лог A
    if (window.Telegram && window.Telegram.WebApp) window.Telegram.WebApp.expand();

    // Инициализация карты (только на главной)
    if (document.getElementById('map')) {
        console.log("DOMContentLoaded: Найден элемент #map, вызываем initMap."); // Лог B
        initMap();
    } else {
         console.log("DOMContentLoaded: Элемент #map не найден на этой странице."); // Лог C
    }

    // --- Обработчики для кнопок "Построить маршрут" (на стр. Маршруты и На авто) ---
    document.querySelectorAll('.build-route-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const routeId = this.dataset.routeId;
            if (routeId) {
                 console.log("Клик по кнопке 'Построить маршрут':", routeId); // Лог
                 localStorage.setItem('buildRouteOnLoad', routeId);
                 window.location.href = '/'; // Переход на главную
            }
        });
    });

    // --- Обработчики для страницы Поиска ---
    const searchBtn = document.getElementById('search-btn');
    const searchInp = document.getElementById('search-input');
    const filterToggleBtn = document.getElementById('filter-toggle-btn');
    const filterOptsDiv = document.getElementById('filter-options');
    const filterChecks = document.querySelectorAll('#filter-options input[type="checkbox"]');

    if (searchBtn && searchInp && filterToggleBtn && filterOptsDiv && filterChecks.length > 0) {
         console.log("DOMContentLoaded: Настройка обработчиков для страницы Поиска."); // Лог
        // Кнопка Поиск
        searchBtn.addEventListener('click', function() {
            searchPlace(searchInp.value);
        });
        // Enter в поле поиска
        searchInp.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchPlace(this.value);
            }
        });
        // Ввод текста в поле поиска
        searchInp.addEventListener('input', function() {
             // Показываем подходящие маршруты при вводе
             displaySuggestions(this.value);
        });
        // Кнопка Фильтр (показать/скрыть опции)
        filterToggleBtn.addEventListener('click', function() {
            const currentlyVisible = filterOptsDiv.style.display === 'block';
            filterOptsDiv.style.display = currentlyVisible ? 'none' : 'block';
            console.log("Фильтр: ", currentlyVisible ? 'Скрыт' : 'Показан'); // Лог
        });
        // Чекбоксы фильтра
        filterChecks.forEach(cb => {
            cb.addEventListener('change', function() {
                searchRouteFilters[this.value] = this.checked; // Обновляем состояние
                console.log("Фильтр изменен:", searchRouteFilters); // Лог
                displaySuggestions(searchInp.value); // Обновляем список маршрутов
            });
        });
        // Показываем начальные маршруты при загрузке стр Поиска
        displaySuggestions();
    } else if (document.getElementById('search-tab')) {
         // Если мы на стр поиска, но элементы не найдены - ошибка
         console.error("DOMContentLoaded: Не удалось найти все элементы для страницы Поиска!");
    }

}); // Конец DOMContentLoaded


// Вызывается из initMap ПОСЛЕ ymaps.ready
function setupMapInteractionHandlers() {
    console.log("setupMapInteractionHandlers: Настройка обработчиков карты..."); // Лог D

    // Кнопка "Проложить маршрут сюда" в деталях точки
    const navigateButton = document.getElementById('navigate-to-point');
    if(navigateButton) {
        navigateButton.addEventListener('click', function() {
            const coordsStr = this.dataset.coords;
            const pointName = this.dataset.name;
            if (!coordsStr || !map || !ymaps) { console.warn("Не могу построить маршрут к точке: нет координат или карты."); return; }

            console.log("Клик: 'Проложить маршрут сюда' к", pointName); // Лог
            const coords = coordsStr.split(',').map(Number);

            clearMap(); // Очищаем карту

            const referencePoints = [];
            if (userLocation) { referencePoints.push([...userLocation]); }
            referencePoints.push({ point: coords, hintContent: pointName }); // Конечная точка

            if (!multiRoute) initMultiRoute(); // Инициализируем, если нужно
            if (!multiRoute) { console.error("Не удалось инициализировать multiRoute для маршрута к точке!"); return; }

            multiRoute.model.setReferencePoints(referencePoints);
            // Используем ТЕКУЩИЙ выбранный тип транспорта (на панели)
            multiRoute.model.setParams({ routingMode: currentTransportType }, true); // Перестраиваем

            // Показываем/скрываем панели
            const routeInfoPanel = document.getElementById('route-info');
            if(routeInfoPanel) routeInfoPanel.style.display = 'block';
            const pointDetailsPanel = document.getElementById('point-details');
            if(pointDetailsPanel) pointDetailsPanel.style.display = 'none';

            // Статус загрузки
            const routeDetails = document.getElementById('route-details');
            if(routeDetails) routeDetails.innerHTML = '<div class="loading">Построение маршрута...</div>';
            const routeInstructions = document.getElementById('route-instructions');
            if(routeInstructions) routeInstructions.innerHTML = '';

            // Добавляем метку конечной точки (т.к. clearMap ее удалил)
            const pointDescEl = document.getElementById('point-description');
            const placemark = new ymaps.Placemark(coords, {
                 hintContent: pointName,
                 balloonContentHeader: pointName,
                 balloonContentBody: pointDescEl ? pointDescEl.innerHTML : ''
            }, {
                 // Синяя иконка
                 iconLayout: 'default#image',
                 iconImageHref: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="27" height="41"><path fill="%23007AFF" d="M13.5 0C6.058 0 0 6.058 0 13.5 0 24.213 13.5 41 13.5 41s13.5-16.787 13.5-27.5C27 6.058 20.942 0 13.5 0zm0 19.125a5.625 5.625 0 1 1 0-11.25 5.625 5.625 0 0 1 0 11.25z"/><circle fill="%23fff" cx="13.5" cy="13.5" r="4.5"/></svg>',
                 iconImageSize: [27, 41],
                 iconImageOffset: [-13.5, -41],
                 zIndex: 400
            });
            map.geoObjects.add(placemark);
            currentPlacemarks.push(placemark); // Добавляем в список для очистки

            addUserPlacemark(); // Восстанавливаем метку пользователя
        });
    } else { console.warn("setupMapInteractionHandlers: Кнопка 'navigate-to-point' не найдена."); }

    // Кнопка "Назад" в деталях точки
    const backButton = document.querySelector('.point-details .back-btn');
    if(backButton) {
        backButton.addEventListener('click', function() {
             console.log("Клик: 'Назад' из деталей точки."); // Лог
            const pointDetailsPanel = document.getElementById('point-details');
            const routeInfoPanel = document.getElementById('route-info');
            if(pointDetailsPanel) pointDetailsPanel.style.display = 'none'; // Скрываем детали
            // Показываем инфо о маршруте, ТОЛЬКО если он активен
            if (routeInfoPanel && multiRoute && multiRoute.getActiveRoute()) {
                routeInfoPanel.style.display = 'block';
            }
        });
    } else { console.warn("setupMapInteractionHandlers: Кнопка '.point-details .back-btn' не найдена."); }

    // Переключение типа транспорта (на панели информации о маршруте)
    document.querySelectorAll('.transport-btn').forEach(btn => {
        btn.addEventListener('click', function() {
             console.log("Клик: Смена типа транспорта на", this.dataset.type); // Лог
            updateRouteTransportType(this.dataset.type);
        });
    });

    console.log("setupMapInteractionHandlers: Обработчики карты настроены."); // Лог E
}

// --- Конец файла script.js ---