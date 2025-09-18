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

// Download current page as PDF
export const downloadSalesReportPdf = async (req, res) => {
    try {
        const { range = "day", startDate, endDate, page = 1, limit = 10 } = req.query;
        const { query } = buildDateFilter(range, startDate, endDate);
        const { items } = await fetchSalesData(query, Number(page), Number(limit));
        const metrics = calculateMetrics(items);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=SalesReport_Page_${page}.pdf`);

        const doc = new PDFDocument({ size: "A4", margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("Sales Report", { underline: true });
        doc.moveDown();
        doc.fontSize(10).text(`Range: ${range.toUpperCase()}`);
        doc.text(`Page: ${page}`);
        doc.moveDown();

        doc.fontSize(12).text(`Overall Orders: ${metrics.count}`);
        doc.text(`Overall Amount: Rs ${metrics.amount}`);
        doc.text(`Overall Discount: Rs ${metrics.discount}`);
        doc.moveDown();

        doc.fontSize(12).text("Orders (current page)");
        doc.moveDown(0.5);
        items.forEach((o) => {
            doc.fontSize(10).text(`Order: ${o.orderId} | Date: ${new Date(o.createdAt).toLocaleString("en-IN")} | Total: Rs ${o.grandTotal} | Discount: Rs ${o.discount}`);
        });

        doc.end();
    } catch (err) {
        console.error("downloadSalesReportPdf error", err);
        res.status(500).send("Internal Server Error");
    }
};

// Download current page as CSV (Excel compatible)
export const downloadSalesReportExcel = async (req, res) => {
    try {
        const { range = "day", startDate, endDate, page = 1, limit = 10 } = req.query;
        const { query } = buildDateFilter(range, startDate, endDate);
        const { items } = await fetchSalesData(query, Number(page), Number(limit));
        const metrics = calculateMetrics(items);

        const rows = [];
        rows.push(["Sales Report"]);
        rows.push([`Range: ${range}`]);
        rows.push([`Page: ${page}`]);
        rows.push([]);
        rows.push(["Overall Orders", "Overall Amount", "Overall Discount"]);
        rows.push([metrics.count, metrics.amount, metrics.discount]);
        rows.push([]);
        rows.push(["Order ID", "Date", "Payment", "Status", "Subtotal", "Discount", "Shipping", "Grand Total"]);
        items.forEach(o => {
            rows.push([
                o.orderId,
                new Date(o.createdAt).toLocaleString("en-IN"),
                o.paymentMethod,
                o.orderStatus,
                o.subtotal,
                o.discount,
                o.shippingCharge,
                o.grandTotal
            ]);
        });

        const csv = rows.map(r => r.map(escapeCsv).join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=SalesReport_Page_${page}.csv`);
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
    query.orderStatus = { $in: ["Confirmed", "Shipped", "Out for Delivery", "Delivered"] };

    return { query, start, end };
}

async function fetchSalesData(query, page, limit) {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
        Order.find(query)
            .populate({ path: "userId", select: "name email" })
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


