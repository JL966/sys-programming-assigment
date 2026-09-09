#ifndef DIAG_H
#define DIAG_H
#define HELLO 1
#define PREPARE 16
#define START 17
#define STATUS 18
#define STOP 19
#define SNAPSHOT 20
#define BACKUP 21
#define ROLE 22
#define PROGRESS 23
unsigned char HardwareProgress(unsigned char value);
unsigned char HardwareRole(unsigned char role);
extern unsigned char xdata display_stage;
#define ARM 32
#define SEND 33
void DiagInit(void);
void DiagUart(void);
void HardwareInit(void);
void HardwareTick(void);
void HardwareSafe(void);
unsigned char HardwarePrepare(unsigned char id);
unsigned char HardwareStart(unsigned char step, unsigned char *p);
void HardwareSnapshot(unsigned char *p);
void HardwareLinkDetails(unsigned char *p);
extern unsigned char xdata current_test, phase, hw_error;
extern unsigned int xdata age, lease;
extern unsigned long xdata uptime;
extern unsigned char xdata evidence[7];
extern unsigned int xdata pair_token, pair_trial;
extern unsigned char xdata pair_direction;
unsigned int Crc(unsigned char *p, unsigned char n);
#endif
