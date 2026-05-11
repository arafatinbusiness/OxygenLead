import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import ExcelJS from "exceljs";

const router = Router();

/**
 * GET /api/report
 * Generates an Excel report of stores with their manual contacts.
 * Query params:
 *   - period: "today" | "week" | "month" | "custom" (default: "today")
 *   - startDate: ISO date string (required if period=custom)
 *   - endDate: ISO date string (required if period=custom)
 * Columns: Company Name, Website, Person Name, Status, Email
 */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || "today";
    let startDate: Date;
    let endDate: Date = new Date();
    let sheetName = "Leads";

    // Calculate date range based on period
    switch (period) {
      case "week": {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
        startDate.setUTCHours(0, 0, 0, 0);
        sheetName = "This Week's Leads";
        break;
      }
      case "month": {
        startDate = new Date();
        startDate.setDate(1); // Start of month
        startDate.setUTCHours(0, 0, 0, 0);
        sheetName = "This Month's Leads";
        break;
      }
      case "custom": {
        if (!req.query.startDate || !req.query.endDate) {
          res.status(400).json({ error: "startDate and endDate are required for custom period" });
          return;
        }
        startDate = new Date(req.query.startDate as string);
        endDate = new Date(req.query.endDate as string);
        endDate.setUTCHours(23, 59, 59, 999); // End of day
        sheetName = "Custom Report";
        break;
      }
      default: {
        // "today"
        startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        sheetName = "Today's Leads";
        break;
      }
    }

    // Fetch stores created in the date range for this user, with their manual contacts
    const stores = await prisma.store.findMany({
      where: {
        userId: req.userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        manualContacts: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OxygenLead";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    // Define columns
    worksheet.columns = [
      { header: "Company Name", key: "companyName", width: 30 },
      { header: "Website", key: "website", width: 35 },
      { header: "Person Name", key: "personName", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Email", key: "email", width: 35 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" }, // Blue background
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 25;

    // Add data rows
    let rowCount = 0;

    for (const store of stores) {
      if (store.manualContacts.length > 0) {
        // One row per contact
        for (const contact of store.manualContacts) {
          worksheet.addRow({
            companyName: store.storeName || store.domain,
            website: store.url,
            personName: contact.personName || "",
            status: contact.status.charAt(0).toUpperCase() + contact.status.slice(1),
            email: contact.email,
          });
          rowCount++;
        }
      } else {
        // Store exists but no manual contacts - still add a row with empty contact fields
        worksheet.addRow({
          companyName: store.storeName || store.domain,
          website: store.url,
          personName: "",
          status: "",
          email: "",
        });
        rowCount++;
      }
    }

    // If no data, add a note row
    if (rowCount === 0) {
      worksheet.addRow({
        companyName: "No stores found in this period",
        website: "",
        personName: "",
        status: "",
        email: "",
      });
    }

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: "middle" };
        // Alternate row colors
        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF3F4F6" },
            };
          });
        }
      }
    });

    // Set response headers for Excel download
    const dateStr = startDate.toISOString().split("T")[0];
    const filename = `oxygenlead-report-${dateStr}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("[v0] Report generation error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;
