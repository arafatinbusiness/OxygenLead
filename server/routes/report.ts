import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import ExcelJS from "exceljs";

const router = Router();

/**
 * GET /api/report
 * Generates an Excel report of stores with their manual contacts and lead export data.
 * Query params:
 *   - period: "today" | "week" | "month" | "custom" (default: "today")
 *   - startDate: ISO date string (required if period=custom)
 *   - endDate: ISO date string (required if period=custom)
 *
 * Columns match the CSV format:
 * First Name, Last Name, Email, Company, Website, Status, Current Layer, Type, Priority,
 * Intent, Current Website Updates, FB Ads Notes, Pixel Status, Custom Notes, Quick Question,
 * Last Email Sent, Next Follow Up, Created At,
 * Positive Point 1-10, Improvements 1-10, Video Link, Image Link
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

    // Fetch stores created in the date range for this user, with their manual contacts and lead export
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
        leadExport: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OxygenLead";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    // Define columns matching the CSV structure
    worksheet.columns = [
      { header: "First Name", key: "firstName", width: 20 },
      { header: "Last Name", key: "lastName", width: 20 },
      { header: "Email", key: "email", width: 35 },
      { header: "Company", key: "company", width: 30 },
      { header: "Website", key: "website", width: 35 },
      { header: "Status", key: "status", width: 15 },
      { header: "Current Layer", key: "currentLayer", width: 15 },
      { header: "Type", key: "type", width: 12 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Intent", key: "intent", width: 20 },
      { header: "Current Website Updates", key: "currentWebsiteUpdates", width: 25 },
      { header: "FB Ads Notes", key: "fbAdsNotes", width: 25 },
      { header: "Pixel Status", key: "pixelStatus", width: 15 },
      { header: "Custom Notes", key: "customNotes", width: 40 },
      { header: "Quick Question", key: "quickQuestion", width: 45 },
      { header: "Last Email Sent", key: "lastEmailSent", width: 20 },
      { header: "Next Follow Up", key: "nextFollowUp", width: 20 },
      { header: "Created At", key: "createdAt", width: 25 },
      { header: "Positive Point 1", key: "positivePoint1", width: 45 },
      { header: "Positive Point 2", key: "positivePoint2", width: 45 },
      { header: "Positive Point 3", key: "positivePoint3", width: 45 },
      { header: "Positive Point 4", key: "positivePoint4", width: 45 },
      { header: "Positive Point 5", key: "positivePoint5", width: 45 },
      { header: "Positive Point 6", key: "positivePoint6", width: 45 },
      { header: "Positive Point 7", key: "positivePoint7", width: 45 },
      { header: "Positive Point 8", key: "positivePoint8", width: 45 },
      { header: "Positive Point 9", key: "positivePoint9", width: 45 },
      { header: "Positive Point 10", key: "positivePoint10", width: 45 },
      { header: "Improvements 1", key: "improvement1", width: 45 },
      { header: "Improvements 2", key: "improvement2", width: 45 },
      { header: "Improvements 3", key: "improvement3", width: 45 },
      { header: "Improvements 4", key: "improvement4", width: 45 },
      { header: "Improvements 5", key: "improvement5", width: 45 },
      { header: "Improvements 6", key: "improvement6", width: 45 },
      { header: "Improvements 7", key: "improvement7", width: 45 },
      { header: "Improvements 8", key: "improvement8", width: 45 },
      { header: "Improvements 9", key: "improvement9", width: 45 },
      { header: "Improvements 10", key: "improvement10", width: 45 },
      { header: "Video Link", key: "videoLink", width: 40 },
      { header: "Image Link", key: "imageLink", width: 40 },
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
      const leadExport = store.leadExport;

      if (store.manualContacts.length > 0) {
        // One row per contact
        for (const contact of store.manualContacts) {
          // Split person name into first/last
          const nameParts = (contact.personName || "").split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          worksheet.addRow({
            firstName,
            lastName,
            email: contact.email,
            company: store.storeName || store.domain,
            website: store.url,
            status: contact.status.charAt(0).toUpperCase() + contact.status.slice(1),
            currentLayer: "L1",
            type: "lead",
            priority: "",
            intent: "",
            currentWebsiteUpdates: "",
            fbAdsNotes: "",
            pixelStatus: "",
            customNotes: leadExport?.customNotes || "",
            quickQuestion: leadExport?.quickQuestion || "",
            lastEmailSent: "",
            nextFollowUp: "",
            createdAt: store.createdAt.toISOString(),
            positivePoint1: leadExport?.positivePoint1 || "",
            positivePoint2: leadExport?.positivePoint2 || "",
            positivePoint3: leadExport?.positivePoint3 || "",
            positivePoint4: leadExport?.positivePoint4 || "",
            positivePoint5: leadExport?.positivePoint5 || "",
            positivePoint6: leadExport?.positivePoint6 || "",
            positivePoint7: leadExport?.positivePoint7 || "",
            positivePoint8: leadExport?.positivePoint8 || "",
            positivePoint9: leadExport?.positivePoint9 || "",
            positivePoint10: leadExport?.positivePoint10 || "",
            improvement1: leadExport?.improvement1 || "",
            improvement2: leadExport?.improvement2 || "",
            improvement3: leadExport?.improvement3 || "",
            improvement4: leadExport?.improvement4 || "",
            improvement5: leadExport?.improvement5 || "",
            improvement6: leadExport?.improvement6 || "",
            improvement7: leadExport?.improvement7 || "",
            improvement8: leadExport?.improvement8 || "",
            improvement9: leadExport?.improvement9 || "",
            improvement10: leadExport?.improvement10 || "",
            videoLink: leadExport?.videoLink || "",
            imageLink: leadExport?.imageLink || "",
          });
          rowCount++;
        }
      } else {
        // Store exists but no manual contacts - still add a row with empty contact fields
        worksheet.addRow({
          firstName: "",
          lastName: "",
          email: "",
          company: store.storeName || store.domain,
          website: store.url,
          status: "",
          currentLayer: "L1",
          type: "lead",
          priority: "",
          intent: "",
          currentWebsiteUpdates: "",
          fbAdsNotes: "",
          pixelStatus: "",
          customNotes: leadExport?.customNotes || "",
          quickQuestion: leadExport?.quickQuestion || "",
          lastEmailSent: "",
          nextFollowUp: "",
          createdAt: store.createdAt.toISOString(),
          positivePoint1: leadExport?.positivePoint1 || "",
          positivePoint2: leadExport?.positivePoint2 || "",
          positivePoint3: leadExport?.positivePoint3 || "",
          positivePoint4: leadExport?.positivePoint4 || "",
          positivePoint5: leadExport?.positivePoint5 || "",
          positivePoint6: leadExport?.positivePoint6 || "",
          positivePoint7: leadExport?.positivePoint7 || "",
          positivePoint8: leadExport?.positivePoint8 || "",
          positivePoint9: leadExport?.positivePoint9 || "",
          positivePoint10: leadExport?.positivePoint10 || "",
          improvement1: leadExport?.improvement1 || "",
          improvement2: leadExport?.improvement2 || "",
          improvement3: leadExport?.improvement3 || "",
          improvement4: leadExport?.improvement4 || "",
          improvement5: leadExport?.improvement5 || "",
          improvement6: leadExport?.improvement6 || "",
          improvement7: leadExport?.improvement7 || "",
          improvement8: leadExport?.improvement8 || "",
          improvement9: leadExport?.improvement9 || "",
          improvement10: leadExport?.improvement10 || "",
          videoLink: leadExport?.videoLink || "",
          imageLink: leadExport?.imageLink || "",
        });
        rowCount++;
      }
    }

    // If no data, add a note row
    if (rowCount === 0) {
      worksheet.addRow({
        company: "No stores found in this period",
      });
    }

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: "middle", wrapText: true };
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
