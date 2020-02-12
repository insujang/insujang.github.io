---
layout: post
title: Generate a Self-signed Certificate
date: 2020-01-07 16:12
category: 
author: "Insu Jang"
tags: [study]
summary: 
---

<div style="width:800px"> <strong style="display:block;margin:12px 0 4px"><a href="https://slideplayer.com/slide/4254412/" title="Public Key Management and X.509 Certificates" target="_blank">Public Key Management and X.509 Certificates</a></strong><iframe src="https://player.slideplayer.com/14/4254412/" width="800" height="649" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" style="border:1px solid #CCC;border-width:1px 1px 0" allowfullscreen></iframe><div style="padding:5px 0 12px"></div></div>

A self-signed certificate is a ceritificate, which is **not** signed by a certificate authority (CA) [^1] [^2].
(There is no parent-like CA when creating a CA, CA itself is a self-signed certificate.)
When using Kubernetes, `kubeadm` automatically genereates a self-signed Kubernetes CA before generating other certificates.


# Steps to create a certificate [^3]

Follow the steps to create a self-signed certificate:

- Generate a private key
- Generate a Certificate Signing Request (CSR)
- Generate a self-signed certificate

## Generate a private key

A generated certificate must be signed with the Certificate Authority's private key, which we are going to make here.
Here we generate 2048bit aes256 key pair.

```
openssl genrsa -aes256 -out rootca.key 2048
```

In C code: [^4] [^5] [^6]
```c
#include <openssl/evp.h>
#include <openssl/rsa.h>
#include <openssl/pem.h>
#include <openssl/x509.h>

EVP_PKEY* generate_key() {
  /* EVP_PKEY structure is for storing an algorithm-independent private key in memory. */
  EVP_PKEY* pkey = EVP_PKEY_new();

  /* Generate a RSA key and assign it to pkey.
   * RSA_generate_key is deprecated.
   */
  BIGNUM* bne = BN_new();
  BN_set_word(bne, RSA_F4);
  RSA* rsa = RSA_new();
  RSA_generate_key_ex(rsa, 2048, bne, nullptr);

  EVP_PKEY_assign_RSA(pkey, rsa);

  return pkey;
}

...
EVP_PKEY* pkey = generate_key();
FILE* pkey_file = fopen("rootca.key", "wb");
PEM_write_PrivateKey(pkey_file, pkey, nullptr, nullptr, 0, nullptr, nullptr);
fclose(pkey_file);
```


```
$ cat rootca.key
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

## Generate a CSR

The CSR is a **request**, which will be sent to a Certificate Authority to ask it to issue a signed certificate.
Here, we want to generate a certificate for a Certificate Authority, we will self-sign the CSR.
There are two ways to create a CSR: by command, and by using a configuration file.

By command, some information needs to be put by manual input.

```
insujang@insujang-tmaxlinux:~/Documents/cert$ openssl req -new -key rootca.key -out rootca.csr                                                               
Enter pass phrase for rootca.key:
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [AU]:
State or Province Name (full name) [Some-State]:
Locality Name (eg, city) []:
Organization Name (eg, company) [Internet Widgits Pty Ltd]:
Organizational Unit Name (eg, section) []:
Common Name (e.g. server FQDN or YOUR name) []:
Email Address []:

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
An optional company name []:
```

The other option is to use an OpenSSL configuration file. (This configuration file can only be usable with openssl)
microk8s seems to use this configuration file to create a certificate authority CSR: you can find it in `/var/snap/microk8s/current/certs/csr.conf`.

> I am not sure whether there is a guideline for this configuration format, but [\[here\]](https://github.com/openssl/openssl/blob/master/apps/openssl.cnf) is an example configuration file for this.

```
$ cat csr.conf
# OpenSSL configuration file for creating a CSR for a certificate authority
# Run openssl req -new -config csr.conf -key rootca.key -out rootca.csr

[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
C = "US"
ST = "Isles of Blessed"
L = "Arkadia"
O = acme
OU = dev
CN = 127.0.0.1

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster
DNS.5 = kubernetes.default.svc.cluster.local
IP.1 = 127.0.0.1
IP.2 = 10.96.0.0

[v3_ext]
authorityKeyIdentifier=keyid,issuer:always

$ openssl req -new -config csr.conf -key rootca.key -out rootca.csr
```

```
$ cat rootca.csr
-----BEGIN CERTIFICATE REQUEST-----
...
-----END CERTIFICATE REQUEST-----
```

In C code, there is no need for CSR creation.

## Generate a self-signed certificate

Generate a temporary certificate valid for 1 year.

```
openssl x509 -req -days 365 -in rootca.csr -signkey rootca.key -out rootca.crt
```

In C code:
```c
X509* generate_x509 (EVP_PKEY* pkey) {
  X509* x509 = X509_new();

  /* set a few parameters of the certificate. */

  /* certificate expiration date: 365 days from now (60s * 60m * 24h * 365d) */
  X509_gmtime_adj(X509_get_notBefore(x509), 0);
  X509_gmtime_adj(X509_get_notAfter(x509), 31536000L);

  X509_set_pubkey(x509, pkey);

  /* set the name of the issuer to the name of the subject. */
  X509_NAME* name = X509_get_subject_name(x509);
  X509_NAME_add_entry_by_txt(name, "C", MBSTRING_ASC, (unsigned char*)"US", -1, -1, 0);
  X509_NAME_add_entry_by_txt(name, "ST", MBSTRING_ASC, (unsigned char*)"Isles of Blessed", -1, -1, 0);
  X509_NAME_add_entry_by_txt(name, "L", MBSTRING_ASC, (unsigned char*)"Arkadia", -1, -1, 0);
  X509_NAME_add_entry_by_txt(name, "O", MBSTRING_ASC, (unsigned char*)"acme", -1, -1, 0);
  X509_NAME_add_entry_by_txt(name, "OU", MBSTRING_ASC, (unsigned char*)"dev", -1, -1, 0);
  X509_NAME_add_entry_by_txt(name, "CN", MBSTRING_ASC, (unsigned char*)"127.0.0.1", -1, -1, 0);

  X509_set_issuer_name(x509, name);

  /* finally sign the certificate with the key. */
  X509_sign(x509, pkey, EVP_sha256());

  return x509;
}
...
EVP_PKEY* pkey = generate_key();
X509* x509 = generate_x509(pkey);
FILE* x509_file = fopen("rootca.crt", "wb");
PEM_write_X509(x509_file, x509);
fclose(x509_file);
```

### Extract information from CRT

```
openssl x509 -in rootca.crt -text -noout
```

 
### Verifying CRT in the code

```c
bool check_certificate_valid(X509* x509) {
  X509_STORE_CTX* ctx = X509_STORE_CTX_new();
  X509_STORE* store = X509_STORE_new();

  X509_STORE_add_cert(store, x509);
  X509_STORE_CTX_init(ctx, store, x509, nullptr);

  return X509_verify_cert(ctx) == 1? true : false;
}
```

## Building the code
```cmake
cmake_minimum_required(VERSION 3.0)
project(create-x509)

find_package(OpenSSL REQUIRED)

include_directories(${OPENSSL_INCLUDE_DIR})

add_executable(x509 x509.cpp)
target_link_libraries(x509 ${OPENSSL_LIBRARIES})
```

Requires `libssl-dev` package to be installed.


[^1]: Self-signed certificate: [https://en.wikipedia.org/wiki/Self-signed_certificate](https://en.wikipedia.org/wiki/Self-signed_certificate)
[^2]: OpenSSL로 Root CA 생성 및 SSL 인증서 발급: [https://www.lesstif.com/pages/viewpage.action?pageId=6979614](https://www.lesstif.com/pages/viewpage.action?pageId=6979614)
[^3]: How to create a self-signed SSL certificate: [https://www.akadia.com/services/ssh_test_certificate.html](https://www.akadia.com/services/ssh_test_certificate.html)
[^4]: How to create a CSR with OpenSSL: [https://www.switch.ch/pki/manage/request/csr-openssl/](https://www.switch.ch/pki/manage/request/csr-openssl/)
[^5]: Generates a self-signed x509 certificate usig OpenSSL: [https://gist.github.com/nathan-osman/5041136](https://gist.github.com/nathan-osman/5041136)
[^6]: OpenSSL을 이용한 X.509 인증서 생성/검사/변환: [https://jasmine125.tistory.com/979](https://jasmine125.tistory.com/979)