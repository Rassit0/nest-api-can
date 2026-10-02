import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistry, ReportHandler } from '../core/registry/report.registry';
import { PrinterService } from 'src/printer/printer.service';
import { PrismaService } from 'src/prisma.service';
import * as path from 'path';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { CourseCycleEnrollmentQueryDto } from '../dto/course-cycle-enrollment.dto';

@Injectable()
export class CourseCycleEnrollmentReport implements ReportHandler, OnModuleInit {
  constructor(
    private readonly registry: ReportRegistry,
    private readonly printer: PrinterService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(
      {
        id: 'course.cycle-enrollment',
        name: 'Lista de inscritos por ciclo',
        description: 'Reporte de estudiantes inscritos en un ciclo de escuela',
        formats: ['pdf'],
        filters: ['discipline', 'school', 'shift', 'cycle'],
        moduleName: 'Escuelas',
      },
      this,
    );
  }

  public extractDataset(enrollments: any[], cycleStartDate: Date, cycleEndDate: Date) {
    // Formatting Name
    const formatName = (person: any) => {
      const parts = [];
      if (person.lastName) parts.push(person.lastName.trim().toUpperCase());
      if (person.secondLastName) parts.push(person.secondLastName.trim().toUpperCase());
      if (person.name) parts.push(person.name.trim().toUpperCase());
      return parts.join(' ').replace(/\s+/g, ' ');
    };

    // Calculate age
    const calculateAge = (birthDate: Date, referenceDate: Date) => {
      let age = referenceDate.getFullYear() - birthDate.getFullYear();
      const m = referenceDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    const dataset = enrollments.map((enrollment) => {
      const person = enrollment.studentMembership.student.person;
      const fullName = formatName(person);
      
      let birthDateStr = '—';
      let ageStr = '—';
      if (person.birthDate) {
        const bd = new Date(person.birthDate);
        birthDateStr = bd.toLocaleDateString('es-BO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
        ageStr = calculateAge(bd, cycleStartDate).toString();
      }
      
      let amountPaid = 0;
      let cyclePaymentDate = '';
      let registrationPaymentDate = '';
      let hasCyclePayment = false;
      let hasRegistrationPayment = false;

      // Cycle payments
      if (enrollment.charge) {
        const c = enrollment.charge;
        const paid = Number(c.amount) - Number(c.pendingAmount) - Number(c.adjustmentAmount);
        if (paid > 0) {
           amountPaid += paid;
           hasCyclePayment = true;
           if (c.payments && c.payments.length > 0) {
             cyclePaymentDate = new Date(c.payments[0].paymentDate).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' });
           }
        }
      }

      // Registration payments (only if this membership started this cycle month/year OR is exactly the start date)
      const membershipStartedAt = new Date(enrollment.studentMembership.startedAt);
      if (enrollment.studentMembership.studentCharges && enrollment.studentMembership.studentCharges.length > 0 && 
         (membershipStartedAt >= cycleStartDate && membershipStartedAt <= cycleEndDate || 
         (membershipStartedAt.getUTCFullYear() === cycleStartDate.getUTCFullYear() && membershipStartedAt.getUTCMonth() === cycleStartDate.getUTCMonth()))) {
         
         const regCharge = enrollment.studentMembership.studentCharges[0].charge;
         const paid = Number(regCharge.amount) - Number(regCharge.pendingAmount) - Number(regCharge.adjustmentAmount);
         if (paid > 0) {
           amountPaid += paid;
           hasRegistrationPayment = true;
           if (regCharge.payments && regCharge.payments.length > 0) {
             registrationPaymentDate = new Date(regCharge.payments[0].paymentDate).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' });
           }
         }
      }

      let finalPaymentDateStr = '—';
      if (hasCyclePayment && !hasRegistrationPayment) {
        finalPaymentDateStr = cyclePaymentDate || '—';
      } else if (!hasCyclePayment && hasRegistrationPayment) {
        finalPaymentDateStr = `Matrícula: ${registrationPaymentDate}`;
      } else if (hasCyclePayment && hasRegistrationPayment) {
        if (cyclePaymentDate === registrationPaymentDate && cyclePaymentDate !== '') {
           finalPaymentDateStr = cyclePaymentDate;
        } else {
           finalPaymentDateStr = `Matrícula: ${registrationPaymentDate}\nCiclo: ${cyclePaymentDate}`;
        }
      }

      return {
        sortFirst: person.lastName ? person.lastName.toLowerCase() : '',
        sortSecond: person.secondLastName ? person.secondLastName.toLowerCase() : '',
        sortNames: person.name ? person.name.toLowerCase() : '',
        id: person.id,
        fullName,
        birthDateStr,
        ageStr,
        amountPaid: amountPaid > 0 ? `Bs ${amountPaid.toFixed(2)}` : '—',
        paymentDate: finalPaymentDateStr,
      };
    });

    dataset.sort((a, b) => {
      if (a.sortFirst < b.sortFirst) return -1;
      if (a.sortFirst > b.sortFirst) return 1;
      if (a.sortSecond < b.sortSecond) return -1;
      if (a.sortSecond > b.sortSecond) return 1;
      if (a.sortNames < b.sortNames) return -1;
      if (a.sortNames > b.sortNames) return 1;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    return dataset;
  }

  async generate(query: CourseCycleEnrollmentQueryDto, format: string): Promise<any> {
    const cycleStartDate = new Date(query.cycleStartDate);
    const cycleEndDate = new Date(query.cycleEndDate);

    const shift = await this.prisma.courseSeasonShift.findUnique({
      where: { id: query.courseSeasonShiftId },
      include: {
        category: true,
        shift: true,
        courseSeason: {
          include: {
            billingConfig: true,
            course: {
              include: {
                school: {
                  include: {
                    discipline: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shift) {
      throw new Error('Shift not found');
    }

    const enrollments = await this.prisma.cycleEnrollment.findMany({
      where: {
        courseSeasonShiftId: query.courseSeasonShiftId,
        cycleStartDate,
        cycleEndDate,
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      include: {
        charge: {
          include: {
            payments: {
              where: { status: 'COMPLETED' },
              orderBy: { paymentDate: 'desc' }
            }
          }
        },
        studentMembership: {
          include: {
            student: {
              include: {
                person: true,
              },
            },
            studentCharges: {
              where: {
                type: 'REGISTRATION',
                charge: { status: { not: 'CANCELLED' } }
              },
              include: {
                charge: {
                  include: {
                    payments: {
                      where: { status: 'COMPLETED' },
                      orderBy: { paymentDate: 'desc' }
                    }
                  }
                }
              }
            }
          },
        },
      },
    });

    const dataset = this.extractDataset(enrollments, cycleStartDate, cycleEndDate);

    const content: Content[] = [
      this.buildHeader(shift, cycleStartDate, cycleEndDate),
      { text: '\n' },
    ];

    if (dataset.length === 0) {
      content.push({
        text: 'No existen inscritos para el ciclo seleccionado.',
        alignment: 'center',
        margin: [0, 20, 0, 0],
        italics: true,
        color: '#555555'
      });
    } else {
      const tableBody: any[][] = [
        [
          { text: 'N°', style: 'tableHeader', alignment: 'center' },
          { text: 'NOMBRE COMPLETO', style: 'tableHeader' },
          { text: 'FECHA NAC.', style: 'tableHeader', alignment: 'center' },
          { text: 'EDAD', style: 'tableHeader', alignment: 'center' },
          { text: 'MONTO PAGADO', style: 'tableHeader', alignment: 'right' },
          { text: 'FECHA DE PAGO', style: 'tableHeader', alignment: 'center' },
        ]
      ];

      dataset.forEach((row, idx) => {
        tableBody.push([
          { text: (idx + 1).toString(), style: 'tableCellCenter' },
          { text: row.fullName, style: 'tableCell' },
          { text: row.birthDateStr, style: 'tableCellCenter' },
          { text: row.ageStr, style: 'tableCellCenter' },
          { text: row.amountPaid, style: 'tableCellRight' },
          { text: row.paymentDate, style: 'tableCellCenter' },
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody,
        },
        layout: {
          hLineWidth: function (i, node) {
            return (i === 0 || i === node.table.body.length) ? 1.5 : 0.5;
          },
          vLineWidth: function (i, node) {
            return 0;
          },
          hLineColor: function (i, node) {
            return (i === 0 || i === 1 || i === node.table.body.length) ? '#1F4E79' : '#E0E0E0';
          },
          paddingTop: function(i) { return 4; },
          paddingBottom: function(i) { return 4; }
        },
        margin: [0, 0, 0, 15],
      });

      content.push({
        text: `TOTAL INSCRITOS: ${dataset.length}`,
        bold: true,
        fontSize: 9,
        color: '#1F4E79',
        alignment: 'right',
        margin: [0, 5, 0, 0]
      });
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 30, 30, 30],
      footer: function (currentPage: number, pageCount: number) {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#555555',
          margin: [0, 10, 0, 0],
        };
      },
      defaultStyle: {
        fontSize: 8,
        lineHeight: 1.2,
      },
      content,
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 8,
          color: '#1F4E79',
          fillColor: '#F5F8FA',
          margin: [0, 4, 0, 4],
        },
        tableCell: {
          fontSize: 8,
          margin: [0, 2, 0, 2],
        },
        tableCellRight: {
          fontSize: 8,
          alignment: 'right',
          margin: [0, 2, 4, 2],
        },
        tableCellCenter: {
          fontSize: 8,
          alignment: 'center',
          margin: [0, 2, 0, 2],
        },
      },
    };

    return this.printer.createPdf(docDefinition);
  }

  private buildHeader(
    shift: any,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ): Content {
    const logo = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');

    const schoolName = shift.courseSeason.course.school.name;
    const disciplineName = shift.courseSeason.course.school.discipline.name;
    const shiftName = shift.shift.name;
    const categoryName = shift.category.name;
    const genderName = shift.gender === 'MALE' ? 'Masculino' : shift.gender === 'FEMALE' ? 'Femenino' : 'Mixto';
    const shiftFullStr = `${shiftName} · ${categoryName} · ${genderName}`;

    let cycleName = '';
    const billingFreq = shift.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    if (billingFreq === 'MONTHLY') {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      cycleName = `${monthNames[cycleStartDate.getMonth()]} ${cycleStartDate.getFullYear()}`;
    } else {
      const typeStr = billingFreq === 'WEEKLY' ? 'Semanal' : billingFreq === 'BIWEEKLY' ? 'Quincenal' : 'Personalizado';
      const d1 = cycleStartDate.toLocaleDateString('es-BO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
      const d2 = cycleEndDate.toLocaleDateString('es-BO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
      cycleName = `${typeStr} · ${d1} - ${d2}`;
    }
    
    return {
      table: {
        widths: ['auto', '*', 'auto'],
        body: [
          [
            {
              image: logo,
              width: 35,
              margin: [0, 2, 8, 2],
              border: [false, false, false, false],
            },
            {
              stack: [
                {
                  text: 'CLUB ATLÉTICO NACIONAL',
                  bold: true,
                  fontSize: 11,
                  color: '#1F4E79',
                },
                {
                  text: 'LISTA DE INSCRITOS POR CICLO',
                  fontSize: 9,
                  bold: true,
                  color: '#555555',
                  margin: [0, 1, 0, 0],
                },
              ],
              margin: [0, 2, 0, 2],
              border: [false, false, false, false],
              alignment: 'left'
            },
            {
              stack: [
                { text: `ESCUELA: ${schoolName}`, fontSize: 8, bold: true, alignment: 'right' },
                { text: `DISCIPLINA: ${disciplineName}`, fontSize: 8, alignment: 'right' },
                { text: `TURNO: ${shiftFullStr}`, fontSize: 8, alignment: 'right' },
                { text: `CICLO: ${cycleName}`, fontSize: 9, bold: true, color: '#1F4E79', alignment: 'right' },
              ],
              margin: [0, 2, 0, 2],
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: function (i, node) {
          return (i === 0 || i === node.table.body.length) ? 1.5 : 0;
        },
        vLineWidth: function (i, node) {
          return 0;
        },
        hLineColor: function (i, node) {
          return '#1F4E79';
        },
      },
      margin: [0, 0, 0, 6],
    };
  }
}
