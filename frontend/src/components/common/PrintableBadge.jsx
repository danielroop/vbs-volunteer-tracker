import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateQRData } from '../../utils/qrCodeGenerator';

/**
 * Reusable badge component for printing student badges
 * Used by both StudentsPage (bulk printing) and StudentDetailPage (single badge)
 */
export default function PrintableBadge({ student, eventId, eventName, size = 'normal' }) {
    const qrData = eventId ? generateQRData(student.id, eventId) : student.id;
    const qrSize = size === 'normal' ? 120 : 150;

    return (
        <div className="student-badge">
            <div className="badge-name">
                {student.firstName} {student.lastName}
            </div>
            <div className="badge-id">
                ID: {student.id}
            </div>
            <div className="badge-qr">
                <QRCodeSVG
                    value={qrData}
                    size={qrSize}
                    level="M"
                    includeMargin={false}
                />
            </div>
            {eventName && (
                <div className="badge-event">
                    {eventName}
                </div>
            )}
        </div>
    );
}
