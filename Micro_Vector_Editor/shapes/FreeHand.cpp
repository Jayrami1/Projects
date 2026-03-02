#include "FreeHand.h"
#include<sstream>
std::string FreeHand::SVG() const {
    if (points.empty()) return "";
    std::ostringstream oss;
    oss<<"<path d=\"M " <<points[0].x() << " " << points[0].y();        // Standard notion meaning somewhat M denotes starting point and 
    for (int i = 1; i < points.size(); ++i) {
        oss<< " L "<<points[i].x() << " " <<points[i].y();              // Each L draws a line between the points
    }
    // Using QColor benifits since it directly identifies the color (and not string)
    oss << "\" stroke=\"" << stroke_Color.name().toStdString()<< "\" fill=\"none\" stroke-width=\"" << strokeWidth << "\" />";
    return oss.str();
}
bool FreeHand::contains(QPointF p) const{    // Within 8 pixel radius of any point
    for (const auto& pt : points) {
        double dx = p.x()- pt.x();
        double dy = p.y() -pt.y();
        if ((dx *dx + dy*dy) < 64) return true;
    }
    return false;
}
std::unique_ptr<GraphicsObject> FreeHand::clone() const {
    return std::make_unique<FreeHand>(*this); // Same logic as in circle
}
void FreeHand::pastePos(double newX, double newY) {
    if (points.empty()) return;                     // paste at each point by dx dy
    double dx = newX -points[0].x();
    double dy = newY - points[0].y();
    for (auto& pt : points) {
        pt.setX(pt.x() + dx);
        pt.setY(pt.y() + dy);
    }
}
void FreeHand::move(double dx, double dy) { // Moves each point by dx dy
    for (auto& pt : points) { pt.rx() += dx; pt.ry() += dy; }
}
void FreeHand::resize(double dx, double dy) {
    return ; // Ig resizing here doesnt make any sense 
}
QRectF FreeHand::getBounds() const {                //Finding rectangle by finding max X and max Y and using min to find width and height of bounding box
    if (points.empty()) return QRectF();
    double minX = points[0].x(), maxX = minX;
    double minY = points[0].y(), maxY = minY;
    for (const auto& p : points) {
        if (p.x() < minX) minX = p.x();
        if (p.x() > maxX) maxX = p.x();
        if (p.y() < minY) minY = p.y();
        if (p.y() > maxY) maxY = p.y();
    }
    return QRectF(minX, minY, maxX - minX, maxY - minY);
}