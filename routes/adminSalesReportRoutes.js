import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminSalesReportController from "../controller/adminSalesReportController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";


const adminSalesReportRoutes = express.Router();

// List page
adminSalesReportRoutes.get(
    "/",
    adminSessionMiddleware,
    adminAuthMiddleware,
    adminSalesReportController.renderSalesReport
);


adminSalesReportRoutes.get(
    "/data",
    adminSessionMiddleware,
    adminAuthMiddleware,
    adminSalesReportController.getSalesReportData
);


adminSalesReportRoutes.get(
    "/download/pdf",
    adminSessionMiddleware,
    adminAuthMiddleware,
    adminSalesReportController.downloadSalesReportPdf
);

adminSalesReportRoutes.get(
    "/download/excel",
    adminSessionMiddleware,
    adminAuthMiddleware,
    adminSalesReportController.downloadSalesReportExcel
);

export default adminSalesReportRoutes