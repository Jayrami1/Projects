#include "Rectangle.h"
#include<sstream>
std::string Rectangle::SVG() const {
    std::ostringstream oss;         // Nothing new
    oss << "<rect x=\"" << x << "\" y=\"" << y 
        << "\" width=\"" << width << "\" height=\"" << height 
        << "\" rx=\"" << rx << "\" ry=\"" << ry << "\""
        << "\" stroke=\"" << stroke_Color.name().toStdString()
        << "\" fill=\"" << fill_Color.name().toStdString() 
        << "\" stroke-width=\"" << strokeWidth << "\" />";
    return oss.str();
}
bool Rectangle::contains(QPointF p) const{          // Within the rectangle using coordinates
    return (p.x()>=x && p.x()<=x+width) && (p.y()>=y && p.y()<=y+width);
}
std::unique_ptr<GraphicsObject> Rectangle::clone() const {
    return std::make_unique<Rectangle>(*this);
}
void Rectangle::pastePos(double newX, double newY) {
    x = newX;               // Changes the corner to new position
    y = newY;
}
void Rectangle::move(double dx, double dy) {x += dx; y += dy;}
void Rectangle::resize(double dx, double dy) { 
    width = std::max(5.0, width + dx); // Resize changes the width and height of rectangle
    height = std::max(5.0, height + dy); 
}
QRectF Rectangle::getBounds() const {           // Itself !
    return QRectF(x, y, width, height);
}