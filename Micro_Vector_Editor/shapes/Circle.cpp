#include "Circle.h"
#include<sstream>
std::string Circle::SVG() const {
    std::ostringstream oss;                                     // ostringstream in order to weave the input parameters from objects for SVG creation
    oss << "<circle cx=\"" << cx << "\" cy=\"" << cy 
        << "\" r=\"" << r 
        << "\" stroke=\"" << stroke_Color.name().toStdString() 
        << "\" fill=\"" << fill_Color.name().toStdString() 
        << "\" stroke-width=\"" << strokeWidth << "\" />";
    return oss.str();
}
bool Circle::contains(QPointF p) const{     // Interior of circle equation (x-cx)^2 + (y-cy)^2 <= r^2
    return (((cx - p.x())*(cx - p.x()) + (cy - p.y())*(cy - p.y())) <= r*r);
}
std::unique_ptr<GraphicsObject> Circle::clone() const { 
    return std::make_unique<Circle>(*this);     // Used to create a unique_ptr object that only it has its ownership, and also 
                                                // new keyword is not used because it leads to memory leaks.
}
void Circle::pastePos(double newX, double newY) {
    cx = newX;      // paste the centre to new position
    cy = newY;
}
void Circle::move(double dx, double dy) {cx += dx; cy += dy; } // move the object to new position
void Circle::resize(double dx, double dy) {r=std::max(5.0, r + dx);} // Resize increases the radius of circle 
                                                                    //(to avoid very small objects atleast 5 pixels is set as min)
QRectF Circle::getBounds() const {          // left -bottom corner and height and width of rectangle as bounding box
    return QRectF(cx - r, cy - r, 2 * r, 2 * r);
}