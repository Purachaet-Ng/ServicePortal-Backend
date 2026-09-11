import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { listStocks, listMovements } from "../services/inventory.service.js";

const labels = {
  IN: "รับเข้า",
  OUT: "ส่งมอบ",
  ADJUST: "ปรับยอด",
  RESERVE: "จอง",
  RELEASE: "คืนยอดจอง",
  RETURN: "รับคืน",
};
export async function getInventoryReport(req, res, next) {
  try {
    const [stocks, movements] = await Promise.all([
      listStocks(req.user, true),
      listMovements(req.user),
    ]);
    const { departmentId, type } = req.valid.query;
    const selectedStocks = stocks.filter(
      (row) => !departmentId || row.departmentId === departmentId,
    );
    const selectedMovements = movements.filter(
      (row) =>
        (!departmentId || row.stock.departmentId === departmentId) &&
        (!type || row.type === type),
    );
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: { Title: "Inventory report" },
    });
    doc.font(
      fileURLToPath(
        new URL("../../assets/fonts/Sarabun-Regular.ttf", import.meta.url),
      ),
    );
    // Build the document completely before responding, so an error is returned as JSON.
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const finished = new Promise((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
    });
    doc.fontSize(20).text("รายงานคลังสินค้า");
    doc
      .fontSize(10)
      .text("ผู้จัดทำ: " + req.user.firstname + " " + req.user.lastname);
    doc.text(
      "วันที่: " +
        new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
    );
    doc.text("ประเภทประวัติ: " + (labels[type] || "ทุกประเภท"));
    doc.moveDown();
    const row = (text) => {
      doc.fontSize(10);
      const height = doc.heightOfString(text, { width: 510 });
      if (doc.y + height + 12 > 780) doc.addPage();
      doc.text(text, { width: 510 });
      doc.moveDown(0.5);
    };
    doc.fontSize(15).text("ยอดคงเหลือ");
    for (const stock of selectedStocks)
      row(
        stock.department.name +
          " | " +
          stock.item.name +
          " | คงเหลือ " +
          stock.onHand +
          " | จอง " +
          stock.reserved +
          " | เบิกได้ " +
          stock.available +
          " " +
          stock.item.unit,
      );
    doc.moveDown();
    doc
      .fontSize(15)
      .text("ประวัติการเคลื่อนไหว (" + selectedMovements.length + " รายการ)");
    for (const movement of selectedMovements) {
      row(
        movement.stock.department.name +
          " | " +
          movement.stock.item.name +
          " | " +
          (labels[movement.type] || movement.type) +
          "\n" +
          new Date(movement.createdAt).toLocaleString("th-TH", {


                        timeZone: "Asia/Bangkok",
          }) +
          " | จำนวน " +
          movement.onHandDelta +
          " | จอง " +
          movement.reservedDelta +
          "\n" +
          "ผู้ทำรายการ: " +
          (movement.actor
            ? movement.actor.firstname + " " + movement.actor.lastname
            : "-") +
          "\n" +
          "หมายเหตุ: " +
          (movement.note || "-"),
      );
    }
    doc.end();
    await finished;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="inventory-report.pdf"',
    );
    res.send(Buffer.concat(chunks));
  } catch (error) {
    next(error);
  }
}
