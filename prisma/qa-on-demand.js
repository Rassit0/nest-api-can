"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
// @ts-nocheck
var client_1 = require("../src/generated/prisma/client");
var prisma = new client_1.PrismaClient();
var API_URL = 'http://localhost:3001/api';
function fetchAPI(url_1) {
    return __awaiter(this, arguments, void 0, function (url, options) {
        var res, data, err;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url, __assign({ headers: { 'Content-Type': 'application/json' } }, options))];
                case 1:
                    res = _a.sent();
                    return [4 /*yield*/, res.json().catch(function () { return null; })];
                case 2:
                    data = _a.sent();
                    if (!res.ok) {
                        err = new Error((data === null || data === void 0 ? void 0 : data.message) || res.statusText);
                        err.response = { status: res.status, data: data };
                        throw err;
                    }
                    return [2 /*return*/, { data: data }];
            }
        });
    });
}
function runQA() {
    return __awaiter(this, void 0, void 0, function () {
        var plan, person, student, course, season, courseSeason, category, shift, courseSeasonShift, event_1, sessionRecord, startedAt, createRes, membershipId, m1, e_1, chargeId, m2, pendingAmount, bookingRes, advanceRes, m3, e_2, chargeId3, m4, currentCycle, sessionNewDate, event2, sessionRecord2, e_3, m5, m6, m7, error_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.log("=== INICIANDO VALIDACIÓN QA ON-DEMAND ===");
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 50, 51, 53]);
                    console.log("Preparando datos de prueba...");
                    return [4 /*yield*/, prisma.paymentPlan.findFirst({ where: { isActive: true } })];
                case 2:
                    plan = _e.sent();
                    if (!plan)
                        throw new Error("No hay PaymentPlan");
                    return [4 /*yield*/, prisma.person.create({
                            data: {
                                name: 'QA Test',
                                lastName: 'OnDemand',
                                documentNumber: "QA-".concat(Date.now()),
                                documentType: 'DNI',
                                email: "qa-".concat(Date.now(), "@test.com"),
                                birthDate: new Date('2000-01-01'),
                            }
                        })];
                case 3:
                    person = _e.sent();
                    return [4 /*yield*/, prisma.student.create({
                            data: { personId: person.id, isActive: true }
                        })];
                case 4:
                    student = _e.sent();
                    return [4 /*yield*/, prisma.course.create({ data: { name: "Course QA ".concat(Date.now()), isActive: true } })];
                case 5:
                    course = _e.sent();
                    return [4 /*yield*/, prisma.season.create({ data: { name: "Season QA ".concat(Date.now()), startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31'), isActive: true } })];
                case 6:
                    season = _e.sent();
                    return [4 /*yield*/, prisma.courseSeason.create({
                            data: {
                                courseId: course.id,
                                seasonId: season.id,
                                status: 'PUBLISHED',
                                billingConfig: { billingType: 'BOTH', billingFrequency: 'MONTHLY', recurringFee: 100 }
                            }
                        })];
                case 7:
                    courseSeason = _e.sent();
                    return [4 /*yield*/, prisma.category.create({ data: { name: 'QA Cat' } })];
                case 8:
                    category = _e.sent();
                    return [4 /*yield*/, prisma.shift.create({ data: { name: 'Morning', startTime: '08:00', endTime: '10:00' } })];
                case 9:
                    shift = _e.sent();
                    return [4 /*yield*/, prisma.courseSeasonShift.create({
                            data: { courseSeasonId: courseSeason.id, categoryId: category.id, shiftId: shift.id, maxMembers: 10 }
                        })];
                case 10:
                    courseSeasonShift = _e.sent();
                    return [4 /*yield*/, prisma.event.create({
                            data: {
                                title: 'Clase QA',
                                startDate: new Date('2024-02-15T10:00:00Z'),
                                endDate: new Date('2024-02-15T12:00:00Z'),
                                isAllDay: false,
                                eventType: 'TRAINING'
                            }
                        })];
                case 11:
                    event_1 = _e.sent();
                    return [4 /*yield*/, prisma.session.create({
                            data: { eventId: event_1.id, durationMin: 120 }
                        })];
                case 12:
                    sessionRecord = _e.sent();
                    return [4 /*yield*/, prisma.sessionCourse.create({
                            data: { sessionId: sessionRecord.id, courseSeasonShiftId: courseSeasonShift.id }
                        })];
                case 13:
                    _e.sent();
                    console.log("\u2713 Datos preparados. StudentID: ".concat(student.id));
                    // PRUEBA 1
                    console.log("\n--- PRUEBA 1: INSCRIPCIÓN INICIAL ---");
                    startedAt = new Date('2024-02-01T10:00:00Z');
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships"), {
                            method: 'POST',
                            body: JSON.stringify({
                                studentId: student.id,
                                courseSeasonId: courseSeason.id,
                                courseSeasonShiftId: courseSeasonShift.id,
                                paymentPlanId: plan.id,
                                startedAt: startedAt.toISOString(),
                                chargeRegistration: false,
                                chargeInitialCycle: true
                            })
                        })];
                case 14:
                    createRes = _e.sent();
                    membershipId = createRes.data.data.id;
                    console.log("\u2713 Membres\u00EDa creada: ".concat(membershipId));
                    return [4 /*yield*/, prisma.studentMembership.findUnique({
                            where: { id: membershipId },
                            include: { cycleEnrollments: true, studentCharges: { include: { charge: true } } }
                        })];
                case 15:
                    m1 = _e.sent();
                    console.log("  - Status: ".concat(m1.status, " (Esperado: ACTIVE)"));
                    console.log("  - Ciclos: ".concat(m1.cycleEnrollments.length, " (Esperado: 1)"));
                    console.log("  - Ciclo Status: ".concat(m1.cycleEnrollments[0].status, " (Esperado: PENDING)"));
                    console.log("  - Charge Status: ".concat(m1.studentCharges[0].charge.status, " (Esperado: PENDING)"));
                    // PRUEBA 4
                    console.log("\n--- PRUEBA 4: ASISTENCIA BLOQUEADA (PENDING) ---");
                    _e.label = 16;
                case 16:
                    _e.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/session-bookings"), {
                            method: 'POST',
                            body: JSON.stringify({
                                sessionId: sessionRecord.id,
                                studentId: student.id,
                                isExternal: false,
                                attended: true
                            })
                        })];
                case 17:
                    _e.sent();
                    console.log("❌ ERROR: El backend permitió la asistencia con ciclo PENDING");
                    return [3 /*break*/, 19];
                case 18:
                    e_1 = _e.sent();
                    if (((_a = e_1.response) === null || _a === void 0 ? void 0 : _a.status) === 403) {
                        console.log("\u2713 Backend rechaz\u00F3 correctamente: ".concat(e_1.response.data.message));
                    }
                    else {
                        throw e_1;
                    }
                    return [3 /*break*/, 19];
                case 19:
                    // PRUEBA 2
                    console.log("\n--- PRUEBA 2: PAGO DEL PRIMER CICLO ---");
                    chargeId = m1.studentCharges[0].charge.id;
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/charges/").concat(chargeId), { method: 'PATCH', body: JSON.stringify({ amount: 10 }) })];
                case 20:
                    _e.sent();
                    return [4 /*yield*/, prisma.studentMembership.findUnique({
                            where: { id: membershipId }, include: { cycleEnrollments: true, studentCharges: { include: { charge: true } } }
                        })];
                case 21:
                    m2 = _e.sent();
                    console.log("  - Despu\u00E9s de pago parcial, Ciclo Status: ".concat(m2.cycleEnrollments[0].status, " (Esperado: PENDING)"));
                    pendingAmount = m2.studentCharges[0].charge.pendingAmount;
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/charges/").concat(chargeId), { method: 'PATCH', body: JSON.stringify({ amount: Number(pendingAmount) }) })];
                case 22:
                    _e.sent();
                    return [4 /*yield*/, prisma.studentMembership.findUnique({
                            where: { id: membershipId }, include: { cycleEnrollments: true, studentCharges: { include: { charge: true } } }
                        })];
                case 23:
                    m2 = _e.sent();
                    console.log("  - Despu\u00E9s de pago total, Charge Status: ".concat(m2.studentCharges[0].charge.status, " (Esperado: PAID)"));
                    console.log("  - Despu\u00E9s de pago total, Ciclo Status: ".concat(m2.cycleEnrollments[0].status, " (Esperado: CONFIRMED)"));
                    // PRUEBA 3
                    console.log("\n--- PRUEBA 3: ASISTENCIA CON CONFIRMED ---");
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/session-bookings"), {
                            method: 'POST',
                            body: JSON.stringify({
                                sessionId: sessionRecord.id,
                                studentId: student.id,
                                isExternal: false,
                                attended: true
                            })
                        })];
                case 24:
                    bookingRes = _e.sent();
                    console.log("\u2713 Asistencia registrada exitosamente! BookingID: ".concat(bookingRes.data.data.id));
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/session-bookings/").concat(bookingRes.data.data.id), { method: 'DELETE' })];
                case 25:
                    _e.sent();
                    console.log("\u2713 Asistencia eliminada exitosamente.");
                    // PRUEBA 5
                    console.log("\n--- PRUEBA 5: GAP (Expiración del ciclo) ---");
                    return [4 /*yield*/, prisma.cycleEnrollment.update({
                            where: { id: m2.cycleEnrollments[0].id },
                            data: { cycleStartDate: new Date('2024-01-01'), cycleEndDate: new Date('2024-01-31') }
                        })];
                case 26:
                    _e.sent();
                    console.log("\u2713 Ciclo retrocedido al pasado. Estado real en BD: ACTIVE pero sin ciclo actual.");
                    // PRUEBA 6
                    console.log("\n--- PRUEBA 6: COMPRAR NUEVO CICLO ---");
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships/").concat(membershipId, "/advance-cycles"), {
                            method: 'POST', body: JSON.stringify({ quantity: 1 })
                        })];
                case 27:
                    advanceRes = _e.sent();
                    console.log("\u2713 Resultado compra: ".concat(advanceRes.data.message));
                    return [4 /*yield*/, prisma.studentMembership.findUnique({
                            where: { id: membershipId }, include: { cycleEnrollments: { orderBy: { cycleStartDate: 'desc' } }, studentCharges: { include: { charge: true } } }
                        })];
                case 28:
                    m3 = _e.sent();
                    console.log("  - Membres\u00EDa Status: ".concat(m3.status, " (Esperado: ACTIVE)"));
                    console.log("  - Total Ciclos: ".concat(m3.cycleEnrollments.length, " (Esperado: 2)"));
                    console.log("  - Nuevo Ciclo Status: ".concat(m3.cycleEnrollments[0].status, " (Esperado: PENDING)"));
                    // PRUEBA 14
                    console.log("\n--- PRUEBA 14: ANTI-DUPLICADO ---");
                    _e.label = 29;
                case 29:
                    _e.trys.push([29, 31, , 32]);
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships/").concat(membershipId, "/advance-cycles"), { method: 'POST', body: JSON.stringify({ quantity: 1 }) })];
                case 30:
                    _e.sent();
                    console.log("\u2713 Permiti\u00F3 comprar el *siguiente* ciclo futuro, no duplic\u00F3.");
                    return [3 /*break*/, 32];
                case 31:
                    e_2 = _e.sent();
                    console.log("\u2713 Bloque\u00F3 correctamente si intent\u00F3 duplicar: ".concat((_c = (_b = e_2.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message));
                    return [3 /*break*/, 32];
                case 32:
                    // PRUEBA 9
                    console.log("\n--- PRUEBA 9: SUSPENDED ---");
                    chargeId3 = m3.cycleEnrollments[0].chargeId;
                    return [4 /*yield*/, prisma.charge.update({ where: { id: chargeId3 }, data: { status: 'PAID', pendingAmount: 0 } })];
                case 33:
                    _e.sent();
                    return [4 /*yield*/, prisma.cycleEnrollment.update({ where: { id: m3.cycleEnrollments[0].id }, data: { status: 'CONFIRMED' } })];
                case 34:
                    _e.sent();
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships/").concat(membershipId, "/suspend"), { method: 'PATCH', body: JSON.stringify({ reason: 'Test' }) })];
                case 35:
                    _e.sent();
                    return [4 /*yield*/, prisma.studentMembership.findUnique({ where: { id: membershipId } })];
                case 36:
                    m4 = _e.sent();
                    console.log("  - Status despu\u00E9s de suspender: ".concat(m4.status, " (Esperado: SUSPENDED)"));
                    _e.label = 37;
                case 37:
                    _e.trys.push([37, 42, , 43]);
                    currentCycle = m3.cycleEnrollments[0];
                    sessionNewDate = new Date(currentCycle.cycleStartDate);
                    sessionNewDate.setDate(sessionNewDate.getDate() + 2);
                    return [4 /*yield*/, prisma.event.create({
                            data: { title: 'Clase QA 2', startDate: sessionNewDate, endDate: sessionNewDate, isAllDay: false, eventType: 'TRAINING' }
                        })];
                case 38:
                    event2 = _e.sent();
                    return [4 /*yield*/, prisma.session.create({ data: { eventId: event2.id, durationMin: 120 } })];
                case 39:
                    sessionRecord2 = _e.sent();
                    return [4 /*yield*/, prisma.sessionCourse.create({ data: { sessionId: sessionRecord2.id, courseSeasonShiftId: courseSeasonShift.id } })];
                case 40:
                    _e.sent();
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/session-bookings"), {
                            method: 'POST', body: JSON.stringify({ sessionId: sessionRecord2.id, studentId: student.id, isExternal: false, attended: true })
                        })];
                case 41:
                    _e.sent();
                    console.log("❌ ERROR: El backend permitió la asistencia estando SUSPENDED");
                    return [3 /*break*/, 43];
                case 42:
                    e_3 = _e.sent();
                    if (((_d = e_3.response) === null || _d === void 0 ? void 0 : _d.status) === 403) {
                        console.log("\u2713 Backend rechaz\u00F3 asistencia por SUSPENDED correctamente: ".concat(e_3.response.data.message));
                    }
                    else {
                        throw e_3;
                    }
                    return [3 /*break*/, 43];
                case 43:
                    // PRUEBA 10
                    console.log("\n--- PRUEBA 10: REINGRESO ---");
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships/").concat(membershipId, "/reactivate"), { method: 'PATCH', body: JSON.stringify({ reason: 'Resume test' }) })];
                case 44:
                    _e.sent();
                    return [4 /*yield*/, prisma.studentMembership.findUnique({ where: { id: membershipId } })];
                case 45:
                    m5 = _e.sent();
                    console.log("  - Status despu\u00E9s de reactivar: ".concat(m5.status, " (Esperado: ACTIVE)"));
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships/").concat(membershipId, "/withdraw"), { method: 'PATCH', body: JSON.stringify({ reason: 'Test withdraw' }) })];
                case 46:
                    _e.sent();
                    return [4 /*yield*/, prisma.studentMembership.findUnique({ where: { id: membershipId } })];
                case 47:
                    m6 = _e.sent();
                    console.log("  - Status despu\u00E9s de withdraw: ".concat(m6.status, " (Esperado: WITHDRAWN)"));
                    return [4 /*yield*/, fetchAPI("".concat(API_URL, "/student-memberships/").concat(membershipId, "/reactivate"), { method: 'PATCH', body: JSON.stringify({ reason: 'Reingreso test' }) })];
                case 48:
                    _e.sent();
                    return [4 /*yield*/, prisma.studentMembership.findUnique({ where: { id: membershipId } })];
                case 49:
                    m7 = _e.sent();
                    console.log("  - Status despu\u00E9s de reingreso: ".concat(m7.status, " (Esperado: ACTIVE)"));
                    console.log("\n=== VALIDACIÓN QA COMPLETADA EXITOSAMENTE ===");
                    return [3 /*break*/, 53];
                case 50:
                    error_1 = _e.sent();
                    console.error("❌ ERROR EN QA:");
                    if (error_1.response) {
                        console.error(error_1.response.data);
                    }
                    else {
                        console.error(error_1);
                    }
                    return [3 /*break*/, 53];
                case 51: return [4 /*yield*/, prisma.$disconnect()];
                case 52:
                    _e.sent();
                    return [7 /*endfinally*/];
                case 53: return [2 /*return*/];
            }
        });
    });
}
runQA();
