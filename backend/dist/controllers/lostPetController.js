import { lostPetService, serializeLostReportForOwner, serializeLostReportForPublic, } from '../services/lostPetService.js';
import { renderLostPetPage } from '../services/lostPetHtmlService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const lostPetController = {
    /**
     * Create or update the active lost report for a pet.
     * POST /pets/:petId/lost-report
     */
    async createOrUpdate(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const { report, created, pet } = await lostPetService.createOrUpdate(userId, petId, input);
        ok(res, { report: serializeLostReportForOwner(report, pet) }, created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK);
    },
    async getActive(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const { report, pet } = await lostPetService.getActive(userId, petId);
        if (!report) {
            ok(res, { report: null });
            return;
        }
        ok(res, { report: serializeLostReportForOwner(report, pet) });
    },
    async getById(req, res) {
        const { userId } = req;
        const { reportId } = req.params;
        const { report, pet } = await lostPetService.getById(userId, reportId);
        ok(res, { report: serializeLostReportForOwner(report, pet) });
    },
    async update(req, res) {
        const { userId } = req;
        const { reportId } = req.params;
        const input = req.body;
        const { report, pet } = await lostPetService.update(userId, reportId, input);
        ok(res, { report: serializeLostReportForOwner(report, pet) });
    },
    async markFound(req, res) {
        const { userId } = req;
        const { reportId } = req.params;
        const { report, pet } = await lostPetService.markFound(userId, reportId);
        ok(res, { report: serializeLostReportForOwner(report, pet) });
    },
    async regenerateToken(req, res) {
        const { userId } = req;
        const { reportId } = req.params;
        const { report, pet } = await lostPetService.regenerateToken(userId, reportId);
        ok(res, { report: serializeLostReportForOwner(report, pet) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { reportId } = req.params;
        await lostPetService.remove(userId, reportId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
    /**
     * Public JSON — no auth.
     */
    async getPublicJson(req, res) {
        const { token } = req.params;
        const { report, pet } = await lostPetService.getPublicByToken(token);
        // Cache at the edge for a short time. The report is read-mostly; a
        // 60-second cache is fine and reduces load.
        res.set('Cache-Control', 'public, max-age=60');
        ok(res, { report: serializeLostReportForPublic(report, pet) });
    },
    /**
     * Public HTML — no auth. The full page a stranger sees.
     */
    async getPublicHtml(req, res) {
        const { token } = req.params;
        const { report, pet } = await lostPetService.getPublicByToken(token);
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=60');
        // Extra safety headers specific to HTML responses:
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        // A minimal CSP that allows only inline styles and Cloudinary images.
        res.set('Content-Security-Policy', [
            "default-src 'none'",
            "img-src https://res.cloudinary.com data:",
            "style-src 'unsafe-inline'",
            "form-action 'none'",
            "base-uri 'none'",
        ].join('; '));
        res.status(HTTP_STATUS.OK).send(renderLostPetPage(report, pet));
    },
};
//# sourceMappingURL=lostPetController.js.map