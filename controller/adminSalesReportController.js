import Order from "../model/oder.js";
import PDFDocument from "pdfkit";

// Render sales report page
export const renderSalesReport = async (req, res) => {
    try {
        const {
            range = "day", // day | week | month | year | custom
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;

        const { query, start, end } = buildDateFilter(range, startDate, endDate);

        const pagination = await fetchSalesData(query, Number(page), Number(limit));
        const metrics = calculateMetrics(pagination.items);

        const urlQuery = new URLSearchParams(req.query).toString();
        res.render("admin-views/adminSalesReport.ejs", {
            range,
            startDate: start ? start.toISOString().slice(0, 16) : "",
            endDate: end ? end.toISOString().slice(0, 16) : "",
            currentPage: pagination.currentPage,
            totalPages: pagination.totalPages,
            totalOrders: pagination.totalItems,
            orders: pagination.items,
            metrics,
            urlQuery
        });
    } catch (err) {
        console.error("renderSalesReport error", err);
        res.status(500).render("error", { status: 500, message: "Internal Server Error" });
    }
};

// JSON data (optional for dynamic reloads)
export const getSalesReportData = async (req, res) => {
    try {
        const {
            range = "day",
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;

        const { query } = buildDateFilter(range, startDate, endDate);
        const pagination = await fetchSalesData(query, Number(page), Number(limit));
        const metrics = calculateMetrics(pagination.items);

        res.json({ success: true, ...pagination, metrics });
    } catch (err) {
        console.error("getSalesReportData error", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Download full period data as PDF
export const downloadSalesReportPdf = async (req, res) => {
    try {
        const { range = "day", startDate, endDate } = req.query;
        const { query } = buildDateFilter(range, startDate, endDate);
        
        // Get ALL orders for the period (not paginated)
        const orders = await Order.find(query)
            .populate({ path: "userId", select: "name email" })
            .populate({ path: "items.productId", select: "name" })
            .sort({ createdAt: -1 })
            .lean();

        const metrics = calculateMetrics(orders);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Aromix_SalesReport_${range}_${new Date().toISOString().split('T')[0]}.pdf`);

        const doc = new PDFDocument({ size: "A4", margin: 40 });
        doc.pipe(res);

        // Company Header
        doc.fontSize(24).text("AROMIX", { align: "center" });
        doc.fontSize(16).text("Sales Report", { align: "center" });
        doc.moveDown();

        // Report Details
        doc.fontSize(12).text(`Report Period: ${range.toUpperCase()}`);
        if (startDate && endDate) {
            doc.text(`Date Range: ${new Date(startDate).toLocaleDateString('en-IN')} to ${new Date(endDate).toLocaleDateString('en-IN')}`);
        }
        doc.text(`Generated On: ${new Date().toLocaleString('en-IN')}`);
        doc.moveDown();

        // Summary
        doc.fontSize(14).text("SUMMARY", { underline: true });
        doc.fontSize(12).text(`Total Orders: ${metrics.count}`);
        doc.text(`Total Revenue: ₹${metrics.amount.toLocaleString()}`);
        doc.text(`Total Discount: ₹${metrics.discount.toLocaleString()}`);
        doc.moveDown();

        // Orders Table
        doc.fontSize(14).text("DETAILED ORDERS", { underline: true });
        doc.moveDown(0.5);

        // Table headers
        const tableTop = doc.y;
        const itemHeight = 20;
        const col1 = 50;
        const col2 = 120;
        const col3 = 200;
        const col4 = 280;
        const col5 = 360;
        const col6 = 440;
        const col7 = 520;

        // Headers
        doc.fontSize(10).text("Order ID", col1, tableTop);
        doc.text("Date", col2, tableTop);
        doc.text("Customer", col3, tableTop);
        doc.text("Payment", col4, tableTop);
        doc.text("Status", col5, tableTop);
        doc.text("Total", col6, tableTop);
        doc.text("Discount", col7, tableTop);

        // Draw header line
        doc.moveTo(col1, tableTop + 15).lineTo(col7 + 60, tableTop + 15).stroke();

        let currentY = tableTop + 20;

        orders.forEach((order, index) => {
            if (currentY > 700) { // New page if needed
                doc.addPage();
                currentY = 50;
            }

            doc.fontSize(8).text(order.orderId, col1, currentY);
            doc.text(new Date(order.createdAt).toLocaleDateString('en-IN'), col2, currentY);
            doc.text(order.userId.name, col3, currentY);
            doc.text(order.paymentMethod, col4, currentY);
            doc.text(order.orderStatus, col5, currentY);
            doc.text(`₹${order.grandTotal}`, col6, currentY);
            doc.text(`₹${order.discount}`, col7, currentY);

            currentY += itemHeight;
        });

        doc.end();
    } catch (err) {
        console.error("downloadSalesReportPdf error", err);
        res.status(500).send("Internal Server Error");
    }
};

// Download full period data as CSV (Excel compatible)
export const downloadSalesReportExcel = async (req, res) => {
    try {
        const { range = "day", startDate, endDate } = req.query;
        const { query } = buildDateFilter(range, startDate, endDate);
        
        // Get ALL orders for the period (not paginated)
        const orders = await Order.find(query)
            .populate({ path: "userId", select: "name email" })
            .populate({ path: "items.productId", select: "name" })
            .sort({ createdAt: -1 })
            .lean();

        const metrics = calculateMetrics(orders);

        const rows = [];
        
        // Company Header
        rows.push(["AROMIX SALES REPORT"]);
        rows.push([]);
        rows.push([`Report Period: ${range.toUpperCase()}`]);
        if (startDate && endDate) {
            rows.push([`Date Range: ${new Date(startDate).toLocaleDateString('en-IN')} to ${new Date(endDate).toLocaleDateString('en-IN')}`]);
        }
        rows.push([`Generated On: ${new Date().toLocaleString('en-IN')}`]);
        rows.push([]);
        
        // Summary
        rows.push(["SUMMARY"]);
        rows.push(["Total Orders", "Total Revenue", "Total Discount"]);
        rows.push([metrics.count, `₹${metrics.amount.toLocaleString()}`, `₹${metrics.discount.toLocaleString()}`]);
        rows.push([]);
        
        // Detailed Orders
        rows.push(["DETAILED ORDERS"]);
        rows.push(["Order ID", "Date", "Customer", "Payment Method", "Status", "Subtotal", "Discount", "Shipping", "Grand Total"]);
        
        orders.forEach(order => {
            rows.push([
                order.orderId,
                new Date(order.createdAt).toLocaleString("en-IN"),
                order.userId.name,
                order.paymentMethod,
                order.orderStatus,
                order.subtotal,
                order.discount,
                order.shippingCharge,
                order.grandTotal
            ]);
        });

        const csv = rows.map(r => r.map(escapeCsv).join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=Aromix_SalesReport_${range}_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        console.error("downloadSalesReportExcel error", err);
        res.status(500).send("Internal Server Error");
    }
};

// Helpers
function buildDateFilter(range, startDate, endDate) {
    let start = null, end = null;
    const now = new Date();
    if (range === "custom" && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
    } else if (range === "day") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (range === "week") {
        const day = now.getDay();
        const diffToMonday = (day + 6) % 7; // Monday as start
        start = new Date(now);
        start.setDate(now.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 7);
    } else if (range === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (range === "year") {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
    }

    const query = {};
    if (start && end) {
        query.createdAt = { $gte: start, $lt: end };
    }
    // Include only completed/valid orders for sales reporting
    query.orderStatus = { $in: [ "Delivered"] };

    return { query, start, end };
}

async function fetchSalesData(query, page, limit) {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
        Order.find(query)
            .populate({ path: "userId", select: "name email" })
            .populate({ path: "items.productId", select: "name" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Order.countDocuments(query)
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    return { items, totalItems, totalPages, currentPage: page, limit };
}

function calculateMetrics(items) {
    const count = items.length;
    const amount = items.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const discount = items.reduce((sum, o) => sum + (o.discount || 0), 0);
    return { count, amount, discount };
}

function escapeCsv(value) {
    if (value == null) return "";
    const str = String(value).replace(/"/g, '""');
    if (str.includes(",") || str.includes("\n") || str.includes("\r")) {
        return `"${str}"`;
    }
    return str;
}


