#include "diagnostic-bsp-stub.h"
unsigned char pwm1,pwm2,step_status,rfid_regs[64];int decode_delta,ultrasonic=100,weight=1000;
void EXTInit(char a){}void SetPWM(unsigned char a,unsigned char b,unsigned char c,unsigned char d){pwm1=a;pwm2=c;}
int GetWeight(void){return weight;}int GetDecode(void){int v=decode_delta;decode_delta=0;return v;}int GetUltraSonic(void){return ultrasonic;}
void StepMotorInit(void){step_status=0;}char SetStepMotor(char m,unsigned char speed,int steps){step_status=1;return enumSetStepMotorOK;}
int EmStop(char m){step_status=0;return 0;}unsigned char GetStepMotorStatus(char m){return step_status;}
unsigned char rd(unsigned char r){return rfid_regs[r];}void wr(unsigned char r,unsigned char v){rfid_regs[r]=v;}
