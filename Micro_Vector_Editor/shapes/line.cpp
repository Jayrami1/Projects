#include "line.h"
#include<sstream>
std::string line::SVG()const{
    std::ostringstream oss;
    oss << "<line x1=\"" << x1 << "\" y1=\"" << y1 
            << "\" x2=\"" << x2 << "\" y2=\"" << y2 
            << "\" stroke=\"" << stroke_Color.name().toStdString()
            << "\" stroke-width=\"" << strokeWidth << "\" />";
        return oss.str();
}
bool line::contains(QPointF p) const{       // Within +- 5 pixel of line approx
    double minX = std::min(x1, x2) - 5;
    double maxX = std::max(x1, x2) + 5;
    double minY = std::min(y1, y2) - 5;
    double maxY = std::max(y1, y2) + 5;
    return (p.x() >= minX && p.x() <= maxX && p.y() >= minY && p.y() <= maxY);
    
}
std::unique_ptr<GraphicsObject> line::clone() const {
    return std::make_unique<line>(*this);
}
void line::pastePos(double newX, double newY) {
    double lenx = x2 -x1;           // x1 y1 made as paste pos and length remaining same
    double leny = y2 - y1;
    y2 = newY + leny;
    x2 = newX + lenx;
    x1 = newX;
    y1 = newY;
}
void line::move(double dx, double dy) { x1 += dx; y1 += dy; x2+= dx; y2 += dy; }    // Moving both points dx dy
void line::resize(double dx, double dy) { x2 += dx; y2 += dy; } // Moving only one of points in resizing 
QRectF line::getBounds() const {
    return QRectF(QPointF(x1, y1), QPointF(x2, y2)).normalized();     // Ensure positive width and height (normalised)
}