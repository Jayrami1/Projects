#include "Hexagon.h"
#include<sstream>
std::string Hexagon::SVG() const {
    std::ostringstream oss;
    oss << "<polygon points=\"";        // Is actualy of type polygon 
    for (int i = 0; i < 6;i++) {        // Finding coordinates of points using trigonometry 
        double vertexAngle = angle + (i * M_PI / 3);    // Mathematical equivalent of pi and then (cx+r cos(theta), cy + rsin(theta))
        oss << cx+r * cos(vertexAngle) << "," << cy+r*sin(vertexAngle) << (i < 5 ? " " : "");
    }
    oss << "\" stroke=\"" << stroke_Color.name().toStdString()  
        << "\" fill=\"" << fill_Color.name().toStdString() 
        << "\" stroke-width=\"" << strokeWidth << "\" />";
    return oss.str();
}
bool Hexagon::contains(QPointF p) const{        // Interior of circle approximation
    double dx =p.x()-cx;
    double dy =p.y()-cy;
    return (dx*dx + dy*dy) <= (r*r);
}
std::unique_ptr<GraphicsObject> Hexagon::clone() const {
    return std::make_unique<Hexagon>(*this); //Same as circle
}
void Hexagon::pastePos(double newX, double newY) {
    cx = newX;
    cy = newY;      //Centre is position of paste
}
void Hexagon::move(double dx, double dy) {cx+= dx; cy += dy; }  // Moving to new centre
void Hexagon::resize(double dx, double dy) {r= std::max(5.0, r + dx);}      // Resizing increase radius
QRectF Hexagon::getBounds() const {             // Circular bounds approx
    return QRectF(cx - r, cy - r, 2 * r, 2 * r);
}