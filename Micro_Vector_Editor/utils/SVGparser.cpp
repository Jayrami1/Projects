#include "SVGparser.h"
#include<iostream>
#include<sstream>
std::string SVGParser::extract(const std::string& lines, const std::string& attr) {
    std::string search = attr + "=\"";      //Find this attribute
    int start = lines.find(search);         // gives start position of attr
    if (start == std::string::npos) return "";  //if start or end npos then return empty and not crash
    start += search.length();   // start moves to values
    int end = lines.find("\"", start);  // find \ closest to start as indexed to zero
    if (end == std::string::npos) return "";    
    return lines.substr(start, end - start);    // return substring from start to end position
}
std::string SVGParser::exportToSVG(const std::vector<std::unique_ptr<GraphicsObject>>& objects, int width, int height){
    std::ostringstream oss;     // ostringstream for eas ystring creation
    oss << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";  // Encoding version Stores width and height and used xmlns to externally identify SVG
    oss << "<svg width=\"" << width << "\" height=\"" << height << "\" xmlns=\"http://www.w3.org/2000/svg\">\n";   
    for (const auto &obj : objects) {if(obj) oss << " " << obj->SVG() << "\n";}// iterating over all objects and adding their SVGs 
    oss << "</svg>"; return oss.str();  // End tag svg
}
void SVGParser::importFromSVG(const std::string& content, std::vector<std::unique_ptr<GraphicsObject>>& objects){
    objects.clear();        // clears objects vector
    std::istringstream stream(content); // content from file given 
    std::string lines;  //stores lines from file using istringstream
    while(std::getline(stream,lines)){     // getline iterated over all lines
        std::unique_ptr<GraphicsObject> obj = nullptr;
        if(lines.find("<rect") != std::string::npos){   // Finding rect tag if found
            auto r = std::make_unique<Rectangle>();     // create rect obj
            r->x = QString::fromStdString(extract(lines, "x")).toDouble();      // using .toDouble() and not std::stod() since stod crashes if it doesnt understand, whereas 0 in this case
            r->y = QString::fromStdString(extract(lines, "y")).toDouble();  // x and y as attributes
            r->width = QString::fromStdString(extract(lines, "width")).toDouble();  //width,height,stroke,fill,stroek-width,rx,ry as input from line
            r->height = QString::fromStdString(extract(lines, "height")).toDouble();
            std::string rxStr = extract(lines, "rx");std::string ryStr = extract(lines, "ry");
            if (!rxStr.empty()) r->rx = QString::fromStdString(rxStr).toDouble();
            if (!ryStr.empty()) r->ry = QString::fromStdString(ryStr).toDouble();
            obj= std::move(r);        // move rect obj to objects vector
        }else if(lines.find("<circle")!=std::string::npos){  // Similar for all objects just that parameters change according to the object
            auto c = std::make_unique<Circle>();
            c->cx = QString::fromStdString(extract(lines, "cx")).toDouble();
            c->cy = QString::fromStdString(extract(lines, "cy")).toDouble();
            c->r = QString::fromStdString(extract(lines, "r")).toDouble();
            obj = std::move(c);
        }else if(lines.find("<line")!=std::string::npos){    //Similar
            auto l = std::make_unique<line>();
            l->x1 = QString::fromStdString(extract(lines, "x1")).toDouble();
            l->y1 = QString::fromStdString(extract(lines, "y1")).toDouble();
            l->x2 = QString::fromStdString(extract(lines, "x2")).toDouble();
            l->y2 = QString::fromStdString(extract(lines, "y2")).toDouble();     
            obj = std::move(l);
        }else if(lines.find("<polygon") != std::string::npos){
            auto h = std::make_unique<Hexagon>();       // In hexagon for points in polygon
            std::string points = extract(lines, "points");
            if (!points.empty()) {
                std::replace(points.begin(), points.end(), ',', ' '); // we replace , with whitespace so that we can use stringstream to iterate through points
                std::stringstream ss(points);
                std::vector<double>coords;     //Coordinates given as xy xy xy pairs 
                double val; //val of coordinates
                while(ss >> val) coords.push_back(val);
                if(coords.size() >= 2) {
                    double sumX = 0, sumY = 0;
                    int numPoints = coords.size() / 2;
                    for(int i = 0; i < coords.size(); i += 2) { // even and odd sums
                        sumX += coords[i]; sumY += coords[i+1];
                    }h->cx = sumX / numPoints;
                    h->cy = sumY / numPoints;// average x and y as centre
                    double dx = coords[0] - h->cx;      // This gives dx dy thus r and thus angle of rotation
                    double dy = coords[1] - h->cy;
                    h->r = std::sqrt(dx*dx + dy*dy);
                    h->angle = std::atan2(dy, dx);      //as mentioned earlier 
                }
            }obj = std::move(h);
        }else if(lines.find("<path") != std::string::npos){
            auto f = std::make_unique<FreeHand>();
            std::string d = extract(lines, "d");
            std::stringstream ss(d);
            std::string cmd;
            double px, py;
            while(ss >> cmd >> px >> py){   // cmd important to know whether first point or intermediate point using straight connection (M or L)
                f->points.push_back(QPointF(px, py));
            }obj = std::move(f);
        }else if(lines.find("<text") != std::string::npos){
            auto t = std::make_unique<Text>();      //instance of text
            t->x = QString::fromStdString(extract(lines, "x")).toDouble();      // x,y coord of text box
            t->y = QString::fromStdString(extract(lines, "y")).toDouble();
            std::string sizestr = extract(lines, "font-size");      // font-size extratced
            if (!sizestr.empty()) { t->font_size = QString::fromStdString(sizestr).toInt();}    // upadting font_size
            t->font_family = extract(lines, "font-family");         // font-family by default aerial if empty else extracted
            if (t->font_family.empty()) t->font_family = "Arial";
            int start = lines.find(">") + 1;        // > marks content start
            int end = lines.find("</text>");        // </text> marks end tag both for content and text box
            if (start != std::string::npos && end != std::string::npos) t->content = lines.substr(start, end - start);
            obj = std::move(t);            // text moved by transferring ownership to objects 
        }if (obj) { // Common attribute extraction for all shapes
            obj->stroke_Color = QColor(QString::fromStdString(extract(lines, "stroke")));
            obj->fill_Color = QColor(QString::fromStdString(extract(lines, "fill")));
            obj->strokeWidth = QString::fromStdString(extract(lines, "stroke-width")).toInt();
            objects.push_back(std::move(obj));
        }
    }
}