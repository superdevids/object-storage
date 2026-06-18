import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { AppError, ErrorCode } from "../types/error.types";

/**
 * Authentication middleware - validates API key from X-API-Key header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
	try {
		const apiKey = req.query["apikey"] as string;
		const validKey = config.apiKey;

		if (!apiKey || apiKey !== validKey) {
			throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or missing API key", 401);
		}

		// API key is valid, proceed
		next();
	} catch (error) {
		next(error);
	}
}
