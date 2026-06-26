# controllers/patient_controller.py
# ── Only the PDF download route remains (all SSR/template routes removed) ──

import os
import re
from io import BytesIO
from datetime import datetime

from flask import Blueprint, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from fpdf import FPDF

from config import UPLOAD_FOLDER
from models.prescription_model import PrescriptionModel

patient_bp = Blueprint("patient", __name__, url_prefix="/patient")

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ---------- Download Prescription (PREMIUM DESIGN) ----------
@patient_bp.route("/prescription/download/<int:appointment_id>")
@jwt_required()
def download_prescription(appointment_id):
    """Generate a high-quality, professional prescription PDF"""

    # 1. Fetch Data
    pres = PrescriptionModel.get_by_appointment(appointment_id)
    if not pres:
        return jsonify({"success": False, "message": "Prescription not found"}), 404
        
    patient_id = get_jwt_identity()
    if str(pres[0].get("patient_id")) != str(patient_id):
        return jsonify({"success": False, "message": "Unauthorized: Prescription does not belong to you"}), 403

    # Helper to clean text
    def clean_text(txt):
        return re.sub(r"[^\x00-\x7F]+", "", str(txt or ""))

    # Extract Data
    record = pres[0]
    patient_name = clean_text(record.get("patient_name", "N/A"))
    patient_age = clean_text(record.get("patient_age", "N/A"))
    patient_gender = clean_text(record.get("patient_gender", "N/A"))
    doctor_name = clean_text(record.get("doctor_name", "Unknown Doctor"))
    doctor_spec = clean_text(record.get("doctor_specialization", "General Physician"))
    
    # Format Date
    date_issued = record.get("created_at") or record.get("date_issued")
    if isinstance(date_issued, str):
        try:
            date_issued = datetime.strptime(date_issued, '%Y-%m-%d %H:%M:%S')
        except:
            date_issued = datetime.now()
    date_str = date_issued.strftime("%d %b, %Y") if date_issued else datetime.now().strftime("%d %b, %Y")

    # 2. Initialize PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)

    # --- 1. HEADER BANNER (Professional Blue) ---
    pdf.set_fill_color(0, 51, 102)  # Dark Navy Blue
    pdf.rect(0, 0, 210, 40, 'F')

    # Logo (if exists)
    logo_path = os.path.join(os.path.dirname(__file__), "..", "static", "images", "logo.png")
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=12, y=6, w=28)

    # Clinic Name (White text on Blue)
    pdf.set_xy(45, 12)
    pdf.set_font("Arial", "B", 22)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "MEDLINK HEALTHCARE", ln=True)
    
    # Subtitle
    pdf.set_xy(45, 22)
    pdf.set_font("Arial", "", 10)
    pdf.cell(0, 6, "Advanced Digital Health Services & Diagnostics", ln=True)

    pdf.ln(15)

    # --- 2. DOCTOR & CLINIC DETAILS (Right Aligned) ---
    pdf.set_text_color(50, 50, 50)
    pdf.set_xy(110, 45)
    pdf.set_font("Arial", "B", 14)
    pdf.cell(85, 6, f"Dr. {doctor_name}", ln=True, align='R')
    
    pdf.set_x(110)
    pdf.set_font("Arial", "I", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(85, 5, f"{doctor_spec}", ln=True, align='R')
    
    pdf.set_x(110)
    pdf.cell(85, 5, "Reg. No: MH-2025-MED", ln=True, align='R')

    # --- 3. PATIENT INFO BOX ---
    pdf.set_fill_color(245, 247, 250)
    pdf.set_draw_color(220, 220, 220)
    pdf.rect(15, 45, 90, 25, 'DF')
    
    pdf.set_xy(18, 48)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(0, 51, 102)
    pdf.cell(25, 5, "PATIENT:", ln=False)
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(60, 5, f"{patient_name}", ln=True)

    pdf.set_x(18)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(0, 51, 102)
    pdf.cell(25, 5, "AGE / SEX:", ln=False)
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(60, 5, f"{patient_age} / {patient_gender}", ln=True)

    pdf.set_x(18)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(0, 51, 102)
    pdf.cell(25, 5, "DATE:", ln=False)
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(60, 5, f"{date_str}", ln=True)

    pdf.ln(15)

    # --- 4. Rx SYMBOL ---
    pdf.set_font("Times", "BI", 36)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(20, 15, "Rx", ln=True)
    
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.5)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(5)

    # --- 5. MEDICATION TABLE ---
    pdf.set_fill_color(0, 51, 102)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Arial", "B", 11)
    pdf.set_line_width(0.1)
    
    pdf.cell(60, 10, " MEDICINE", 1, 0, 'L', True)
    pdf.cell(40, 10, " DOSAGE", 1, 0, 'C', True)
    pdf.cell(80, 10, " INSTRUCTIONS", 1, 1, 'L', True)

    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(0, 0, 0)
    
    for i, row in enumerate(pres):
        if i % 2 == 0:
            pdf.set_fill_color(255, 255, 255)
        else:
            pdf.set_fill_color(240, 245, 255)

        med_name = clean_text(row.get("medicine_name"))
        dosage = clean_text(row.get("dosage"))
        notes = clean_text(row.get("notes", "-"))

        line_height = 8
        lines = max(1, len(notes) // 45 + 1)
        row_height = lines * line_height

        x_axis = pdf.get_x()
        y_axis = pdf.get_y()

        if y_axis + row_height > 270:
            pdf.add_page()
            y_axis = pdf.get_y()

        pdf.cell(60, row_height, f"  {med_name}", border=1, ln=0, fill=True)
        pdf.cell(40, row_height, dosage, border=1, ln=0, align='C', fill=True)
        
        pdf.set_xy(x_axis + 100, y_axis)
        pdf.multi_cell(80, line_height, notes, border=1, align='L', fill=True)
        pdf.set_xy(x_axis, y_axis + row_height)

    pdf.ln(20)

    # --- 6. FOOTER & SIGNATURE ---
    if pdf.get_y() > 250:
        pdf.add_page()
    
    pdf.set_draw_color(100, 100, 100)
    pdf.line(130, pdf.get_y(), 190, pdf.get_y())
    pdf.set_xy(130, pdf.get_y() + 2)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(60, 5, "Doctor's Signature", align='C', ln=True)

    pdf.set_y(-30)
    pdf.set_fill_color(240, 240, 240)
    pdf.rect(0, 270, 210, 30, 'F')
    
    pdf.set_y(-25)
    pdf.set_font("Arial", "I", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, "This document is digitally generated and is valid for medical purposes.", align='C', ln=True)
    pdf.cell(0, 5, "MedLink Healthcare | Emergency Contact: 108 | www.medlink.com", align='C', ln=True)

    pdf_bytes = pdf.output(dest="S")

    return send_file(
        BytesIO(pdf_bytes),
        as_attachment=True,
        download_name=f"Prescription_{patient_name}_{date_str}.pdf",
        mimetype="application/pdf"
    )