import { deviceService, serializeDevice } from '../services/deviceService.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ok } from '../utils/apiResponse.js';
export const deviceController = {
    async register(req, res) {
        const { userId } = req;
        const input = req.body;
        const device = await deviceService.register(userId, input);
        ok(res, { device: serializeDevice(device) }, HTTP_STATUS.CREATED);
    },
    async unregister(req, res) {
        const { userId } = req;
        const input = req.body;
        await deviceService.unregister(userId, input);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=deviceController.js.map