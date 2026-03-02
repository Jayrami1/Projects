#include "Text.h"
#include<sstream>
#include <QFont>
#include <QFontMetrics>
std::string Text::SVG() const { // Extra font_style and size to be given 
                                // NOTE : FONT COLOR is same as fill color
    std::ostringstream oss;
    oss << "<text x=\"" << x << "\" y=\"" << y 
        << "\" fill=\"" << fill_Color.name().toStdString() 
        << "\" font-size=\"" << font_size << "\""
        << " font-family=\"" << font_family << "\">" //
        << content << "</text>";
    return oss.str();
}
bool Text::contains(QPointF p) const {      // Contains approximation based on font_size and content length
    double w = content.length() * (font_size * 0.6);
    double h = font_size * 1.5;
    return (p.x() >= x && p.x() <= x + w) && (p.y() >= y && p.y() <= y + h);
}
std::unique_ptr<GraphicsObject> Text::clone() const {
    return std::make_unique<Text>(*this);
}
void Text::pastePos(double newX, double newY) {     // Move and paste to new x and y
    x = newX;
    y = newY;
}
void Text::move(double dx, double dy) {
    x += dx;
    y += dy;
}

void Text::resize(double dx, double dy) {                           // CHanges font_size
    font_size = std::max(5, font_size + static_cast<int>(dx/2));    // When certainity of casting using static_cast reduces overhead
}
QRectF Text::getBounds() const {                        
    QFont font(QString::fromStdString(font_family));                // QFont library used for font_style
    font.setPointSize(font_size);                                   // Setting font_size
    QFontMetrics metrics(font);                                     // QFontMetrics give nearly accurate bounding box(tried using earlier one but very inaccurate
                                                                    // so using library)
    QRect rect = metrics.boundingRect(QString::fromStdString(content));
    return QRectF(x, y, rect.width()+5, rect.height()+5);   // Approx rect based on metrics
}