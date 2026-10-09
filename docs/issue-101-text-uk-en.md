# Текст для Issue в J-A-A-M/jaam_fusion

Заголовок і текст копіюй окремо. Спочатку українська версія, нижче англійська. Одну з двох залиш в Issue, другу можна додати коментарем.

---

## 🇺🇦 Українська версія

**Заголовок:**
Пропозиція: плавна яскравість від датчика світла, яскравість дисплея, незалежна лампа

**Текст:**

Привіт! Я користувач JAAM (ESP32 і ESP32-C3, дисплей SH1106, датчик BH1750). Зробив доповнення для яскравості на базі 5.1.2-b3 і хотів би запропонувати їх в офіційну версію. Спершу питаю, чи це цікаво, щоб не кидати великий PR без обговорення.

### Навіщо
У 4.x яскравість мапи плавно залежала від датчика світла. У 5.x лишився тільки ступінчастий вибір день/ніч, а дисплей вміє лише вмикатись і вимикатись вночі.

### Що пропоную
1. **Режими яскравості мапи.** До існуючих додається «Автояскравість» (плавно між «Малою» і «Великою» за освітленням). Режим «Сенсор освітлення» отримує три повзунки: Велика, Мала день, Мала ніч. Повзунок «Чутливість сенсора» (0,1–30×) для автояскравості.
2. **Яскравість дисплея.** Повзунок, перемикач «Автояскравість дисплея» і «Мінімальна яскравість дисплея».
3. **Виправлення SH1106.** U8g2 ініціалізує його як SSD1306 (pre-charge `0xF1`), через що регулювання яскравості майже не працює. Після старту надсилаю `0xD9, 0x1F` (значення з Adafruit SH1106G), і діапазон повертається як у 4.x.
4. **Режим «Лампа».** Перемикач «Прив'язати яскравість лампи до загальної яскравості» (за замовчуванням увімкнений, поведінка як зараз). Також лампа вмикає дисплей, вимкнений вночі за часом.
5. **WebSocket API й `jaam_ha`.** Об'єкт `brightness`, команда `set_brightness`, сутності в Home Assistant (з'являються тільки якщо прошивка їх повідомляє).

Якщо нових налаштувань не чіпати, мапа поводиться як раніше. Нових бібліотек немає.

### Код
- Прошивка: https://github.com/Rsa76d/jaam_fusion/tree/lux8-brightness
- Зміни відносно офіційної гілки: https://github.com/Rsa76d/jaam_fusion/compare/lux8-brightness
- Інтеграція HA: https://github.com/Rsa76d/jaam_ha/tree/lux5-brightness

Зачеплено 15 файлів (+588 / −19). Основна логіка в `src/JaamFusion.cpp`, дисплей у `src/JaamDisplay.cpp`, лампа в `src/JaamLed.cpp`.

### Як перевірено
- Збірка для `esp32` і `esp32c3` без попереджень.
- Алгоритм плавної яскравості прогнано окремо на комп'ютері.
- На залізі (SH1106 128×64, BH1750): спершу на ESP32-C3, пізніше, зокрема остання версія, на ESP32. Режими 2 і 3, яскравість дисплея, лампа, нічне вимкнення дисплея.
- **Не перевірено:** дисплеї SSD1306 і SH1107 (код загальний, pre-charge чіпається тільки для SH1106), довгі випробування на різних платах.

### Відоме обмеження
При дуже великій чутливості (20–30×) «Мала яскравість» майже недосяжна: треба освітленість нижче сотих часток люкса, а BH1750 має крок 0,5 лк і бачить власну підсвітку мапи. Можна обмежити діапазон до ~10× або додати поріг «темряви». Готовий зробити так, як зручніше вам.

### Питання
Чи цікаво це для офіційної версії? Якщо так, як вам зручніше: один PR чи кілька? Я пропоную чотири: (1) режими яскравості мапи, API й веб-інтерфейс, (2) яскравість дисплея з виправленням SH1106, (3) режим лампи, (4) `jaam_ha`.

Дякую за проєкт!

---

## 🇬🇧 English version

**Title:**
Proposal: smooth light-sensor brightness, display brightness, independent lamp mode

**Body:**

Hi! I'm a JAAM user (ESP32 and ESP32-C3, SH1106 display, BH1750 sensor). I built a set of brightness improvements on top of 5.1.2-b3 and would like to propose them for the official firmware. I'm asking first, before sending a big PR.

### Why
In 4.x the map brightness followed the light sensor smoothly. In 5.x only a stepped day/night choice remains, and the display can only be switched on/off at night.

### What I propose
1. **Map brightness modes.** A new "Auto brightness" mode (smooth between "Low" and "High" based on ambient light). The "Light sensor" mode gets three sliders: High, Low (day), Low (night). A "Sensor sensitivity" slider (0.1–30×) for auto brightness.
2. **Display brightness.** A slider, an "Auto display brightness" switch and a "Minimum display brightness" slider.
3. **SH1106 fix.** U8g2 initializes it like an SSD1306 (pre-charge `0xF1`), so brightness barely changes. After start I send `0xD9, 0x1F` (the Adafruit SH1106G value), which restores the 4.x range.
4. **Lamp mode.** A "Bind lamp brightness to global brightness" switch (on by default, current behaviour). The lamp also turns on a display that is off at night.
5. **WebSocket API and `jaam_ha`.** A `brightness` object, a `set_brightness` command, and Home Assistant entities (created only if the firmware reports them).

With the new settings untouched, the map behaves as before. No new libraries.

### Code
- Firmware: https://github.com/Rsa76d/jaam_fusion/tree/lux8-brightness
- Diff against the official branch: https://github.com/Rsa76d/jaam_fusion/compare/lux8-brightness
- HA integration: https://github.com/Rsa76d/jaam_ha/tree/lux5-brightness

15 files touched (+588 / −19). Main logic in `src/JaamFusion.cpp`, display in `src/JaamDisplay.cpp`, lamp in `src/JaamLed.cpp`.

### Testing
- Builds for `esp32` and `esp32c3` without warnings.
- The smooth-brightness algorithm was run separately on a PC.
- On hardware (SH1106 128×64, BH1750): first on ESP32-C3, later, including the latest version, on ESP32. Modes 2 and 3, display brightness, lamp, night display-off.
- **Not tested:** SSD1306 and SH1107 displays (the code is generic, the pre-charge tweak applies only to SH1106), and long-term runs on different boards.

### Known limitation
With very high sensitivity (20–30×) the "Low" brightness is hard to reach: it needs ambient light below hundredths of a lux, while the BH1750 steps by 0.5 lx and sees the map's own glow. The range could be limited to ~10× or a "darkness" threshold added. Happy to do whichever you prefer.

### Question
Is this of interest for the official firmware? If so, would you prefer one PR or several? I suggest four: (1) map brightness modes, API and web UI, (2) display brightness with the SH1106 fix, (3) lamp mode, (4) `jaam_ha`.

Thanks for the project!
