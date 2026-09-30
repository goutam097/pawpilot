import type { Request, Response } from 'express';
import {
  lostPetService,
  serializeLostReportForOwner,
  serializeLostReportForPublic,
} from '../services/lostPetService.js';
import { renderLostPetPage } from '../services/lostPetHtmlService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateLostPetReportInput,
  UpdateLostPetReportInput,
} from '../validators/lostPetValidators.js';

export const lostPetController = {
  /**
   * Create or update the active lost report for a pet.
   * POST /pets/:petId/lost-report
   */
  async createOrUpdate(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateLostPetReportInput;
    const { report, created, pet, role } = await lostPetService.createOrUpdate(userId, petId, input);
    ok(
      res,
      { report: serializeLostReportForOwner(report, pet, role) },
      created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK,
    );
  },

  async getActive(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const { report, pet, role } = await lostPetService.getActive(userId, petId);
    if (!report) {
      ok(res, { report: null });
      return;
    }
    ok(res, { report: serializeLostReportForOwner(report, pet, role) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { reportId } = req.params as { reportId: string };
    const { report, pet, role } = await lostPetService.getById(userId, reportId);
    ok(res, { report: serializeLostReportForOwner(report, pet, role) });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { reportId } = req.params as { reportId: string };
    const input = req.body as UpdateLostPetReportInput;
    const { report, pet, role } = await lostPetService.update(userId, reportId, input);
    ok(res, { report: serializeLostReportForOwner(report, pet, role) });
  },

  async markFound(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { reportId } = req.params as { reportId: string };
    const { report, pet, role } = await lostPetService.markFound(userId, reportId);
    ok(res, { report: serializeLostReportForOwner(report, pet, role) });
  },

  async regenerateToken(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { reportId } = req.params as { reportId: string };
    const { report, pet, role } = await lostPetService.regenerateToken(userId, reportId);
    ok(res, { report: serializeLostReportForOwner(report, pet, role) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { reportId } = req.params as { reportId: string };
    await lostPetService.remove(userId, reportId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  /**
   * Public JSON — no auth.
   */
  async getPublicJson(req: Request, res: Response): Promise<void> {
    const { token } = req.params as { token: string };
    const { report, pet } = await lostPetService.getPublicByToken(token);

    // Cache at the edge for a short time. The report is read-mostly; a
    // 60-second cache is fine and reduces load.
    res.set('Cache-Control', 'public, max-age=60');
    ok(res, { report: serializeLostReportForPublic(report, pet) });
  },

  /**
   * Public HTML — no auth. The full page a stranger sees.
   */
  async getPublicHtml(req: Request, res: Response): Promise<void> {
    const { token } = req.params as { token: string };
    const { report, pet } = await lostPetService.getPublicByToken(token);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60');
    // Extra safety headers specific to HTML responses:
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    // A minimal CSP that allows only inline styles and Cloudinary images.
    res.set(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        "img-src https://res.cloudinary.com data:",
        "style-src 'unsafe-inline'",
        "form-action 'none'",
        "base-uri 'none'",
      ].join('; '),
    );

    res.status(HTTP_STATUS.OK).send(renderLostPetPage(report, pet));
  },
};